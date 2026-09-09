import { CARDANO_DEX_API_CONFIG } from '../../config/price-aggregation';
import { CardanoTokenConfig, IrisToken, LiquidityPool } from '../../types';
import { CardanoPoolProvider, errorMessage, positiveNumber } from './cardano-pool-provider';

interface MinswapAsset {
  currency_symbol?: unknown;
  token_name?: unknown;
  metadata?: { decimals?: unknown; name?: unknown; ticker?: unknown } | null;
}

interface MinswapMetric {
  type?: unknown;
  lp_asset?: MinswapAsset | null;
  asset_a?: MinswapAsset | null;
  asset_b?: MinswapAsset | null;
  liquidity_a?: unknown;
  liquidity_b?: unknown;
}

function assetId(asset: MinswapAsset | null | undefined): string | null {
  return typeof asset?.currency_symbol === 'string' && typeof asset.token_name === 'string'
    ? `${asset.currency_symbol}${asset.token_name}`.toLowerCase()
    : null;
}

function isAda(asset: MinswapAsset | null | undefined): boolean {
  return asset?.currency_symbol === '' && asset.token_name === '';
}

function tokenInfo(asset: MinswapAsset, fallback: CardanoTokenConfig | null): IrisToken {
  const decimals = asset.metadata?.decimals;
  return {
    policyId: fallback?.policyId ?? null,
    nameHex: fallback?.assetName ?? '',
    decimals:
      typeof decimals === 'number' && Number.isInteger(decimals) && decimals >= 0
        ? decimals
        : undefined,
    name:
      typeof asset.metadata?.name === 'string'
        ? asset.metadata.name
        : (fallback?.symbol ?? 'Cardano'),
    ticker:
      typeof asset.metadata?.ticker === 'string'
        ? asset.metadata.ticker
        : (fallback?.symbol ?? 'ADA'),
  };
}

function normalizeMetric(metric: unknown, token: CardanoTokenConfig): LiquidityPool | null {
  if (!metric || typeof metric !== 'object') return null;
  const pool = metric as MinswapMetric;
  const target = `${token.policyId}${token.assetName}`.toLowerCase();
  const tokenOnA = assetId(pool.asset_a) === target && isAda(pool.asset_b);
  const tokenOnB = assetId(pool.asset_b) === target && isAda(pool.asset_a);
  if (!tokenOnA && !tokenOnB) return null;

  const quantityA = positiveNumber(pool.liquidity_a);
  const quantityB = positiveNumber(pool.liquidity_b);
  if (quantityA === null || quantityB === null) return null;
  const tokenReserve = tokenOnA ? quantityA : quantityB;
  const adaReserve = tokenOnA ? quantityB : quantityA;
  const lpPolicy =
    typeof pool.lp_asset?.currency_symbol === 'string' ? pool.lp_asset.currency_symbol : '';
  const lpName = typeof pool.lp_asset?.token_name === 'string' ? pool.lp_asset.token_name : '';
  const identifier = `${lpPolicy}${lpName}`;
  if (!identifier) return null;
  const tvl = 2 * adaReserve;
  const price = adaReserve / tokenReserve;
  if (!Number.isFinite(tvl) || tvl <= 0 || !Number.isFinite(price) || price <= 0) return null;

  return {
    dex: typeof pool.type === 'string' && pool.type ? pool.type : 'Minswap',
    identifier,
    pair: {
      tokenA: tokenInfo((tokenOnA ? pool.asset_a : pool.asset_b)!, token),
      tokenB: tokenInfo((tokenOnA ? pool.asset_b : pool.asset_a)!, null),
    },
    state: {
      reserveA: tokenReserve,
      reserveB: adaReserve,
      tvl,
      price,
      liquidityProvider: 'Minswap',
    },
    lastUpdated: new Date(),
    isActive: true,
  };
}

export class MinswapPoolProvider implements CardanoPoolProvider {
  readonly id = 'minswap' as const;

  async discoverPools(token: CardanoTokenConfig): Promise<LiquidityPool[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CARDANO_DEX_API_CONFIG.MINSWAP.TIMEOUT);
    let response: Response;
    try {
      response = await fetch(`${CARDANO_DEX_API_CONFIG.MINSWAP.BASE_URL}/v1/pools/metrics`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          term: `${token.policyId}${token.assetName}`,
          only_verified: false,
          limit: 100,
          sort_field: 'liquidity',
          sort_direction: 'desc',
        }),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeout);
      throw new Error(`Minswap pool API network error: ${errorMessage(error)}`);
    }
    if (!response.ok) {
      clearTimeout(timeout);
      throw new Error(`Minswap pool API HTTP error: ${response.status}`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      clearTimeout(timeout);
      if (controller.signal.aborted)
        throw new Error('Minswap pool API network error: request timed out');
      throw new Error(`Minswap pool API schema error: ${errorMessage(error)}`);
    }
    clearTimeout(timeout);
    const metrics = (payload as { pool_metrics?: unknown } | null)?.pool_metrics;
    if (!Array.isArray(metrics))
      throw new Error('Minswap pool API schema error: expected pool_metrics array');
    return metrics
      .map(metric => normalizeMetric(metric, token))
      .filter((pool): pool is LiquidityPool => pool !== null);
  }
}
