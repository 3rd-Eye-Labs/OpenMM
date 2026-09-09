import { PoolDiscoveryCLI } from '../../../cli/pool-discovery-core';

const normalizedPool = (identifier: string, price: number) => ({
  dex: 'MinswapV2',
  identifier,
  state: { tvl: 200000, reserveA: 100, reserveB: 50, price },
  pair: { tokenA: { ticker: 'INDY' }, tokenB: { ticker: 'ADA' } },
  isActive: true,
});

describe('PoolDiscoveryCLI', () => {
  let log: jest.SpyInstance;
  beforeEach(() => {
    log = jest.spyOn(console, 'log').mockImplementation();
  });
  afterEach(() => {
    log.mockRestore();
  });

  it('discovers against normalized ADA and reports normalized pool prices without Iris', async () => {
    const cli = new PoolDiscoveryCLI();
    const internals = cli as unknown as {
      poolDiscovery: { discoverPools: jest.Mock };
      priceService: { getTokenPrice: jest.Mock };
    };
    internals.poolDiscovery = {
      discoverPools: jest
        .fn()
        .mockResolvedValue([normalizedPool('one', 0.5), normalizedPool('two', 0.25)]),
    };
    internals.priceService = {
      getTokenPrice: jest.fn().mockRejectedValue(new Error('USD unavailable')),
    };

    await cli.getPoolPrices(['two', 'one'], 'INDY', true);

    expect(internals.poolDiscovery.discoverPools).toHaveBeenCalledWith(
      'ADA',
      expect.objectContaining({ symbol: 'INDY' })
    );
    const output = JSON.parse(
      log.mock.calls
        .map(call => call[0])
        .find(value => typeof value === 'string' && value.startsWith('{'))
    );
    expect(output.pools).toEqual([
      { identifier: 'two', priceAda: 0.25 },
      { identifier: 'one', priceAda: 0.5 },
    ]);
    expect(output.averagePriceAda).toBe(0.375);
  });
});
