import {
  CardanoPoolDiscovery,
  CardanoPoolProvider,
} from '../../../../core/price-aggregation/cardano-pool-discovery';
import { CardanoTokenConfig, LiquidityPool } from '../../../../types';

const token: CardanoTokenConfig = {
  symbol: 'INDY',
  policyId: 'policy',
  assetName: 'asset',
  minLiquidityThreshold: 100,
};
const pool = (dex: string, identifier: string, tvl: number): LiquidityPool => ({
  dex,
  identifier,
  state: { tvl, reserveA: 10, reserveB: 10, price: 1 },
});
const provider = (
  id: 'minswap' | 'sundaeswap',
  result: LiquidityPool[] | Error
): CardanoPoolProvider => ({
  id,
  discoverPools: jest
    .fn()
    .mockImplementation(() =>
      result instanceof Error ? Promise.reject(result) : Promise.resolve(result)
    ),
});

describe('CardanoPoolDiscovery', () => {
  it('aggregates independently, filters, deduplicates, and sorts by TVL', async () => {
    const minswap = provider('minswap', [
      pool('Minswap', 'low', 99),
      pool('Minswap', 'shared', 200),
    ]);
    const sundae = provider('sundaeswap', [
      pool('SundaeSwap', 'top', 300),
      pool('Minswap', 'shared', 200),
    ]);
    const pools = await new CardanoPoolDiscovery([minswap, sundae]).discoverPools('ADA', token);
    expect(pools.map(item => item.identifier)).toEqual(['top', 'shared']);
    expect(minswap.discoverPools).toHaveBeenCalledWith(token);
    expect(sundae.discoverPools).toHaveBeenCalledWith(token);
  });

  it('returns one provider when the other fails and accepts common ADA identifiers', async () => {
    for (const base of ['ADA', 'ada', 'lovelace', 'ada.lovelace']) {
      const pools = await new CardanoPoolDiscovery([
        provider('minswap', new Error('HTTP 503')),
        provider('sundaeswap', [pool('SundaeSwap', base, 200)]),
      ]).discoverPools(base, token);
      expect(pools).toHaveLength(1);
    }
  });

  it('rejects unsupported base assets without calling providers', async () => {
    const minswap = provider('minswap', []);
    await expect(new CardanoPoolDiscovery([minswap]).discoverPools('USDC', token)).rejects.toThrow(
      'Unsupported Cardano pool base asset: USDC'
    );
    expect(minswap.discoverPools).not.toHaveBeenCalled();
  });

  it('reports categorized provider failures when all providers fail', async () => {
    await expect(
      new CardanoPoolDiscovery([
        provider('minswap', new Error('Minswap pool API HTTP error: 503')),
        provider('sundaeswap', new Error('SundaeSwap pool API schema error: malformed')),
      ]).discoverPools('lovelace', token)
    ).rejects.toThrow(/all providers failed.*minswap \[HTTP\].*sundaeswap \[schema\]/i);
  });
});
