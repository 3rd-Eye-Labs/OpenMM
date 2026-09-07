import { CARDANO_DEX_API_CONFIG } from '../../config/price-aggregation';
import { CardanoTokenConfig } from '../../types';
import { CardanoDexPriceProvider, CardanoDexPriceQuote } from './cardano-dex-price-provider';

const ADA_ASSET_ID = 'ada.lovelace';
const POOLS_BY_ASSET_QUERY = `
  query PoolsByAsset($asset: ID!) {
    pools {
      byAsset(asset: $asset) {
        id
        version
        assets { id decimals }
        current {
          quantityA { quantity asset { id decimals } }
          quantityB { quantity asset { id decimals } }
        }
      }
    }
  }
`;

interface SundaeAsset {
  id?: unknown;
  decimals?: unknown;
}

interface SundaeAssetAmount {
  quantity?: unknown;
  asset?: SundaeAsset | null;
}

interface SundaePool {
  assets?: SundaeAsset[] | null;
  current?: {
    quantityA?: SundaeAssetAmount | null;
    quantityB?: SundaeAssetAmount | null;
  } | null;
}

interface WeightedPoolQuote {
  priceAda: number;
  liquidityAda: number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizedQuantity(quantity: unknown, decimals: unknown): number | null {
  if (typeof quantity !== 'number' && typeof quantity !== 'string') {
    return null;
  }
  if (typeof quantity === 'string' && quantity.trim() === '') {
    return null;
  }
  if (typeof decimals !== 'number') {
    return null;
  }

  const raw = Number(quantity);
  const precision = decimals;
  if (!Number.isFinite(raw) || raw <= 0 || !Number.isInteger(precision) || precision < 0) {
    return null;
  }

  const normalized = raw / 10 ** precision;
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
}

function poolQuote(pool: unknown, tokenId: string): WeightedPoolQuote | null {
  if (!pool || typeof pool !== 'object') {
    return null;
  }

  const candidate = pool as SundaePool;
  const quantityA = candidate.current?.quantityA;
  const quantityB = candidate.current?.quantityB;
  const assetAId = quantityA?.asset?.id;
  const assetBId = quantityB?.asset?.id;
  const isTokenAda = assetAId === tokenId && assetBId === ADA_ASSET_ID;
  const isAdaToken = assetAId === ADA_ASSET_ID && assetBId === tokenId;
  if (!isTokenAda && !isAdaToken) {
    return null;
  }

  const normalizedA = normalizedQuantity(quantityA?.quantity, quantityA?.asset?.decimals);
  const normalizedB = normalizedQuantity(quantityB?.quantity, quantityB?.asset?.decimals);
  if (normalizedA === null || normalizedB === null) {
    return null;
  }

  const adaReserve = isAdaToken ? normalizedA : normalizedB;
  const tokenReserve = isAdaToken ? normalizedB : normalizedA;
  const priceAda = adaReserve / tokenReserve;
  const liquidityAda = 2 * adaReserve;
  if (!Number.isFinite(priceAda) || priceAda <= 0 || !Number.isFinite(liquidityAda)) {
    return null;
  }

  return { priceAda, liquidityAda };
}

export class SundaeSwapPriceProvider implements CardanoDexPriceProvider {
  readonly id = 'sundaeswap' as const;

  async getTokenAdaQuote(token: CardanoTokenConfig): Promise<CardanoDexPriceQuote> {
    const tokenId = `${token.policyId}.${token.assetName}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CARDANO_DEX_API_CONFIG.SUNDAESWAP.TIMEOUT);

    let response: Response;
    try {
      response = await fetch(CARDANO_DEX_API_CONFIG.SUNDAESWAP.GRAPHQL_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: POOLS_BY_ASSET_QUERY, variables: { asset: tokenId } }),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeout);
      throw new Error(`SundaeSwap price API network error: ${errorMessage(error)}`);
    }

    if (!response.ok) {
      clearTimeout(timeout);
      throw new Error(`SundaeSwap price API HTTP error: ${response.status}`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      clearTimeout(timeout);
      throw new Error(`SundaeSwap price API schema error: ${errorMessage(error)}`);
    }
    clearTimeout(timeout);

    const result = payload as {
      errors?: Array<{ message?: unknown }>;
      data?: { pools?: { byAsset?: unknown } };
    } | null;

    if (Array.isArray(result?.errors) && result.errors.length > 0) {
      const messages = result.errors
        .map(error => String(error?.message ?? 'unknown error'))
        .join('; ');
      throw new Error(`SundaeSwap price API GraphQL error: ${messages}`);
    }

    const pools = result?.data?.pools?.byAsset;
    if (!Array.isArray(pools)) {
      throw new Error('SundaeSwap price API schema error: expected pools.byAsset array');
    }

    const quotes = pools
      .map(pool => poolQuote(pool, tokenId))
      .filter((quote): quote is WeightedPoolQuote => quote !== null);
    if (quotes.length === 0) {
      throw new Error('SundaeSwap price API schema error: no valid direct ADA pools');
    }

    const maximumLiquidity = Math.max(...quotes.map(quote => quote.liquidityAda));
    let scaledLiquidity = 0;
    let priceAda = 0;

    for (const quote of quotes) {
      const weight = quote.liquidityAda / maximumLiquidity;
      const nextLiquidity = scaledLiquidity + weight;
      priceAda += (quote.priceAda - priceAda) * (weight / nextLiquidity);
      scaledLiquidity = nextLiquidity;
    }

    const liquidityAda = quotes.reduce((sum, quote) => sum + quote.liquidityAda, 0);
    if (!Number.isFinite(priceAda) || priceAda <= 0) {
      throw new Error('SundaeSwap price API schema error: non-finite aggregate price');
    }
    if (!Number.isFinite(liquidityAda) || liquidityAda <= 0) {
      throw new Error('SundaeSwap price API schema error: non-finite aggregate liquidity');
    }

    return {
      provider: this.id,
      priceAda,
      liquidityAda,
      poolsUsed: quotes.length,
      timestamp: new Date(),
    };
  }
}
