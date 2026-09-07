import { MinswapPoolProvider } from '../../../../core/price-aggregation/minswap-pool-provider';
import { CardanoTokenConfig } from '../../../../types';

const token: CardanoTokenConfig = { symbol: 'INDY', policyId: 'policy', assetName: '494e4459' };
const tokenAsset = {
  currency_symbol: 'policy',
  token_name: '494e4459',
  metadata: { decimals: 6, ticker: 'INDY' },
};
const adaAsset = { currency_symbol: '', token_name: '', metadata: { decimals: 6, ticker: 'ADA' } };
const response = (body: unknown, ok = true, status = 200): Response =>
  ({ ok, status, json: jest.fn().mockResolvedValue(body) }) as unknown as Response;

describe('MinswapPoolProvider', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('posts the full asset ID and normalizes direct ADA pools with the token first', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      response({
        pool_metrics: [
          {
            type: 'MinswapV2',
            lp_asset: { currency_symbol: 'lp-policy', token_name: 'lp-name' },
            asset_a: adaAsset,
            asset_b: tokenAsset,
            liquidity_a: '250.5',
            liquidity_b: '1000',
          },
          {
            type: 'MinswapV2',
            lp_asset: { currency_symbol: 'ignored', token_name: 'other' },
            asset_a: tokenAsset,
            asset_b: { currency_symbol: 'other', token_name: 'asset' },
            liquidity_a: 1,
            liquidity_b: 2,
          },
        ],
      })
    );

    const pools = await new MinswapPoolProvider().discoverPools(token);
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://api-mainnet-prod.minswap.org/v1/pools/metrics');
    expect(options).toMatchObject({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    expect(JSON.parse(options.body)).toEqual({
      term: 'policy494e4459',
      only_verified: false,
      limit: 100,
      sort_field: 'liquidity',
      sort_direction: 'desc',
    });
    expect(pools).toHaveLength(1);
    expect(pools[0]).toMatchObject({
      dex: 'MinswapV2',
      identifier: 'lp-policylp-name',
      pair: {
        tokenA: { policyId: 'policy', nameHex: '494e4459', ticker: 'INDY' },
        tokenB: { policyId: null, nameHex: '', ticker: 'ADA' },
      },
      state: {
        reserveA: 1000,
        reserveB: 250.5,
        tvl: 501,
        price: 0.2505,
        liquidityProvider: 'Minswap',
      },
      isActive: true,
    });
  });

  it('rejects malformed pool_metrics responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(response({ pool_metrics: null }));
    await expect(new MinswapPoolProvider().discoverPools(token)).rejects.toThrow(
      'Minswap pool API schema error'
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

    const pending = new MinswapPoolProvider().discoverPools(token);
    const assertion = expect(pending).rejects.toThrow(
      'Minswap pool API network error: request timed out'
    );
    await jest.advanceTimersByTimeAsync(10000);
    await assertion;
    jest.useRealTimers();
  });
});
