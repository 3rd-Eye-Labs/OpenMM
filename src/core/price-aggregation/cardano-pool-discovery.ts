import { CardanoTokenConfig, LiquidityPool } from '../../types';
import { CardanoPoolProvider, errorMessage } from './cardano-pool-provider';
import { MinswapPoolProvider } from './minswap-pool-provider';
import { SundaeSwapPoolProvider } from './sundaeswap-pool-provider';

export type { CardanoPoolProvider } from './cardano-pool-provider';

const ADA_BASE_ASSETS = new Set(['ada', 'lovelace', 'ada.lovelace']);

function category(error: unknown): string {
  const message = errorMessage(error).toLowerCase();
  if (message.includes('http')) return 'HTTP';
  if (message.includes('network') || message.includes('abort')) return 'network';
  if (message.includes('graphql')) return 'GraphQL';
  if (message.includes('schema')) return 'schema';
  return 'unknown';
}

export class CardanoPoolDiscovery {
  constructor(
    private readonly providers: CardanoPoolProvider[] = [
      new MinswapPoolProvider(),
      new SundaeSwapPoolProvider(),
    ]
  ) {}

  async discoverPools(baseAsset: string, token: CardanoTokenConfig): Promise<LiquidityPool[]> {
    if (!ADA_BASE_ASSETS.has(baseAsset.toLowerCase()))
      throw new Error(`Unsupported Cardano pool base asset: ${baseAsset}`);
    const results = await Promise.allSettled(
      this.providers.map(provider => provider.discoverPools(token))
    );
    const failures: string[] = [];
    const pools: LiquidityPool[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') pools.push(...result.value);
      else
        failures.push(
          `${this.providers[index].id} [${category(result.reason)}]: ${errorMessage(result.reason)}`
        );
    });
    if (failures.length === this.providers.length)
      throw new Error(`Cardano pool discovery all providers failed: ${failures.join('; ')}`);

    const threshold = token.minLiquidityThreshold ?? 0;
    const deduplicated = new Map<string, LiquidityPool>();
    for (const pool of pools) {
      if (Number(pool.state?.tvl ?? 0) < threshold) continue;
      const key = `${pool.dex.toLowerCase()}:${pool.identifier.toLowerCase()}`;
      const existing = deduplicated.get(key);
      if (!existing || Number(pool.state?.tvl ?? 0) > Number(existing.state?.tvl ?? 0))
        deduplicated.set(key, pool);
    }
    const sorted = [...deduplicated.values()].sort(
      (a, b) => Number(b.state?.tvl ?? 0) - Number(a.state?.tvl ?? 0)
    );
    if (!sorted.length) {
      const thresholdText = threshold > 0 ? ` meeting minimum liquidity ${threshold} ADA` : '';
      throw new Error(`No direct ADA liquidity pools found for ${token.symbol}${thresholdText}`);
    }
    return sorted;
  }
}
