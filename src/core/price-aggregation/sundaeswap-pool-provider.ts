import { CARDANO_DEX_API_CONFIG } from '../../config/price-aggregation';
import { CardanoTokenConfig, IrisToken, LiquidityPool } from '../../types';
import { CardanoPoolProvider, errorMessage, positiveNumber } from './cardano-pool-provider';

const ADA_ASSET_ID = 'ada.lovelace';
const POOLS_BY_ASSET_QUERY = `
  query PoolsByAsset($asset: ID!) {
    pools {
      byAsset(asset: $asset) {
        id
        version
        current {
          quantityA { quantity asset { id decimals } }
          quantityB { quantity asset { id decimals } }
        }
      }
    }
  }
`;

interface SundaeAmount {
  quantity?: unknown;
  asset?: { id?: unknown; decimals?: unknown } | null;
}
interface SundaePool {
  id?: unknown;
  version?: unknown;
  current?: { quantityA?: SundaeAmount | null; quantityB?: SundaeAmount | null } | null;
}

function normalizeAmount(amount: SundaeAmount | null | undefined): number | null {
  const raw = positiveNumber(amount?.quantity);
  const decimals = amount?.asset?.decimals;
  if (raw === null || typeof decimals !== 'number' || !Number.isInteger(decimals) || decimals < 0)
    return null;
  const value = raw / 10 ** decimals;
  return Number.isFinite(value) && value > 0 ? value : null;
}

function tokenInfo(id: string, decimals: number, token: CardanoTokenConfig | null): IrisToken {
  return {
    policyId: token?.policyId ?? null,
    nameHex: token?.assetName ?? '',
    decimals,
    ticker: token?.symbol ?? 'ADA',
    name: token?.symbol ?? 'Cardano',
  };
}

function normalizePool(
  value: unknown,
  token: CardanoTokenConfig,
  tokenId: string
): LiquidityPool | null {
  if (!value || typeof value !== 'object') return null;
  const pool = value as SundaePool;
  const amountA = pool.current?.quantityA;
  const amountB = pool.current?.quantityB;
  const idA = amountA?.asset?.id;
  const idB = amountB?.asset?.id;
  const tokenOnA = idA === tokenId && idB === ADA_ASSET_ID;
  const tokenOnB = idB === tokenId && idA === ADA_ASSET_ID;
  if ((!tokenOnA && !tokenOnB) || typeof pool.id !== 'string' || !pool.id) return null;
  const quantityA = normalizeAmount(amountA);
  const quantityB = normalizeAmount(amountB);
  if (quantityA === null || quantityB === null) return null;
  const tokenAmount = tokenOnA ? amountA! : amountB!;
  const adaAmount = tokenOnA ? amountB! : amountA!;
  const tokenReserve = tokenOnA ? quantityA : quantityB;
  const adaReserve = tokenOnA ? quantityB : quantityA;
  const tvl = 2 * adaReserve;
  const price = adaReserve / tokenReserve;
  if (!Number.isFinite(tvl) || tvl <= 0 || !Number.isFinite(price) || price <= 0) return null;
  const tokenDecimals = tokenAmount.asset!.decimals as number;
  const adaDecimals = adaAmount.asset!.decimals as number;
  return {
    dex: `SundaeSwap${typeof pool.version === 'string' && pool.version ? ` ${pool.version}` : ''}`,
    identifier: pool.id,
    pair: {
      tokenA: tokenInfo(tokenId, tokenDecimals, token),
      tokenB: tokenInfo(ADA_ASSET_ID, adaDecimals, null),
    },
    state: {
      reserveA: tokenReserve,
      reserveB: adaReserve,
      tvl,
      price,
      liquidityProvider: 'SundaeSwap',
    },
    lastUpdated: new Date(),
    isActive: true,
  };
}

export class SundaeSwapPoolProvider implements CardanoPoolProvider {
  readonly id = 'sundaeswap' as const;

  async discoverPools(token: CardanoTokenConfig): Promise<LiquidityPool[]> {
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
      throw new Error(`SundaeSwap pool API network error: ${errorMessage(error)}`);
    }
    if (!response.ok) {
      clearTimeout(timeout);
      throw new Error(`SundaeSwap pool API HTTP error: ${response.status}`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      clearTimeout(timeout);
      if (controller.signal.aborted)
        throw new Error('SundaeSwap pool API network error: request timed out');
      throw new Error(`SundaeSwap pool API schema error: ${errorMessage(error)}`);
    }
    clearTimeout(timeout);
    const result = payload as {
      errors?: Array<{ message?: unknown }>;
      data?: { pools?: { byAsset?: unknown } };
    } | null;
    if (Array.isArray(result?.errors) && result.errors.length) {
      throw new Error(
        `SundaeSwap pool API GraphQL error: ${result.errors.map(item => String(item.message ?? 'unknown error')).join('; ')}`
      );
    }
    const pools = result?.data?.pools?.byAsset;
    if (!Array.isArray(pools))
      throw new Error('SundaeSwap pool API schema error: expected pools.byAsset array');
    return pools
      .map(pool => normalizePool(pool, token, tokenId))
      .filter((pool): pool is LiquidityPool => pool !== null);
  }
}
