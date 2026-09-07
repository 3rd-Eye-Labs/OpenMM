import { SundaeSwapPoolProvider } from '../../../../core/price-aggregation/sundaeswap-pool-provider';
import { CardanoTokenConfig } from '../../../../types';

const token: CardanoTokenConfig = { symbol: 'SNEK', policyId: 'policy', assetName: '534e454b' };
const tokenId = 'policy.534e454b';
const response = (body: unknown, ok = true, status = 200): Response =>
  ({ ok, status, json: jest.fn().mockResolvedValue(body) }) as unknown as Response;
const amount = (id: string, decimals: number, quantity: string) => ({
  quantity,
  asset: { id, decimals },
});

describe('SundaeSwapPoolProvider', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('queries the dotted ID and normalizes raw quantities with token first', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      response({
        data: {
          pools: {
            byAsset: [
              {
                id: 'sundae-pool',
                version: 'V3',
                current: {
                  quantityA: amount('ada.lovelace', 6, '500000000'),
                  quantityB: amount(tokenId, 0, '1000000'),
                },
              },
              {
                id: 'not-direct',
                version: 'V3',
                current: {
                  quantityA: amount(tokenId, 0, '1'),
                  quantityB: amount('other.asset', 6, '1'),
                },
              },
            ],
          },
        },
      })
    );

    const pools = await new SundaeSwapPoolProvider().discoverPools(token);
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://api.sundae.fi/graphql');
    expect(JSON.parse(options.body).variables).toEqual({ asset: tokenId });
    expect(JSON.parse(options.body).query).toContain('byAsset(asset: $asset)');
    expect(pools).toHaveLength(1);
    expect(pools[0]).toMatchObject({
      dex: 'SundaeSwap V3',
      identifier: 'sundae-pool',
      pair: {
        tokenA: { policyId: 'policy', nameHex: '534e454b', decimals: 0, ticker: 'SNEK' },
        tokenB: { policyId: null, nameHex: '', decimals: 6, ticker: 'ADA' },
      },
      state: {
        reserveA: 1000000,
        reserveB: 500,
        tvl: 1000,
        price: 0.0005,
        liquidityProvider: 'SundaeSwap',
      },
      isActive: true,
    });
  });

  it('reports GraphQL errors and rejects malformed pool arrays', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      response({ errors: [{ message: 'resolver failed' }] })
    );
    await expect(new SundaeSwapPoolProvider().discoverPools(token)).rejects.toThrow(
      'SundaeSwap pool API GraphQL error: resolver failed'
    );
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      response({ data: { pools: { byAsset: null } } })
    );
    await expect(new SundaeSwapPoolProvider().discoverPools(token)).rejects.toThrow(
      'SundaeSwap pool API schema error'
    );
  });

  it('keeps the timeout active while reading the response body', async () => {
    jest.useFakeTimers();
    (global.fetch as jest.Mock).mockImplementation((_url: string, options: RequestInit) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          new Promise((_resolve, reject) =>
            options.signal?.addEventListener('abort', () => reject(new Error('body aborted')))
          ),
      })
    );

    const pending = new SundaeSwapPoolProvider().discoverPools(token);
    const assertion = expect(pending).rejects.toThrow(
      'SundaeSwap pool API network error: request timed out'
    );
    await jest.advanceTimersByTimeAsync(10000);
    await assertion;
    jest.useRealTimers();
  });
});
