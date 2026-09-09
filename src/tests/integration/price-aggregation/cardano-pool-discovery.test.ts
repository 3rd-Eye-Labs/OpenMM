/**
 * Live integration coverage for keyless Cardano pool discovery.
 */
import { CardanoPoolDiscovery } from '../../../core/price-aggregation';
import { getTokenConfig } from '../../../config/price-aggregation';

jest.setTimeout(30000);

describe('CardanoPoolDiscovery live integration', () => {
  it('discovers normalized direct ADA/INDY pools without Iris', async () => {
    const pools = await new CardanoPoolDiscovery().discoverPools('ADA', getTokenConfig('INDY'));

    expect(pools.length).toBeGreaterThan(0);
    expect(pools.some(pool => pool.dex.toLowerCase().includes('minswap'))).toBe(true);
    expect(pools.some(pool => pool.dex.toLowerCase().includes('sundaeswap'))).toBe(true);

    for (const pool of pools) {
      expect(pool.pair?.tokenA?.ticker).toBe('INDY');
      expect(pool.pair?.tokenB?.ticker).toBe('ADA');
      expect(pool.state?.reserveA).toBeGreaterThan(0);
      expect(pool.state?.reserveB).toBeGreaterThan(0);
      expect(pool.state?.tvl).toBeGreaterThan(0);
      expect(pool.state?.price).toBeGreaterThan(0);
      expect(Number.isFinite(pool.state?.price)).toBe(true);
    }
  });
});
