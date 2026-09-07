import { SundaeSwapPriceProvider } from '../../../../core/price-aggregation/sundaeswap-price-provider';
import { CardanoTokenConfig } from '../../../../types';

const token: CardanoTokenConfig = {
  symbol: 'SNEK',
  policyId: 'policy',
  assetName: '534e454b',
};
const tokenId = 'policy.534e454b';

const pool = (
  assetA: { id: string; decimals: number },
  assetB: { id: string; decimals: number },
  quantityA: string,
  quantityB: string
) => ({
  id: `${assetA.id}-${assetB.id}-${quantityA}`,
  version: 'V3',
  assets: [assetA, assetB],
  current: {
    quantityA: { quantity: quantityA, asset: assetA },
    quantityB: { quantity: quantityB, asset: assetB },
  },
});

const response = (body: unknown, ok = true, status = 200): Response =>
  ({ ok, status, json: jest.fn().mockResolvedValue(body) }) as unknown as Response;

describe('SundaeSwapPriceProvider', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('queries by dotted asset ID and handles ADA on side A with zero-decimal tokens', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      response({
        data: {
          pools: {
            byAsset: [
              pool(
                { id: 'ada.lovelace', decimals: 6 },
                { id: tokenId, decimals: 0 },
                '500000000',
                '1000000'
              ),
            ],
          },
        },
      })
    );

    const quote = await new SundaeSwapPriceProvider().getTokenAdaQuote(token);

    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://api.sundae.fi/graphql');
    expect(options).toMatchObject({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    const request = JSON.parse(options.body);
    expect(request.variables).toEqual({ asset: tokenId });
    expect(request.query).toContain('query PoolsByAsset($asset: ID!)');
    expect(request.query).toContain('byAsset(asset: $asset)');
    expect(request.query).toContain('assets { id decimals }');
    expect(request.query).toContain('quantityA { quantity asset { id decimals } }');
    expect(quote).toMatchObject({
      provider: 'sundaeswap',
      priceAda: 0.0005,
      liquidityAda: 1000,
      poolsUsed: 1,
    });
    expect(quote.timestamp).toBeInstanceOf(Date);
  });

  it('handles the token on side A and liquidity-weights all valid direct ADA pools', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      response({
        data: {
          pools: {
            byAsset: [
              pool(
                { id: tokenId, decimals: 2 },
                { id: 'ada.lovelace', decimals: 6 },
                '10000',
                '200000000'
              ),
              pool(
                { id: 'ada.lovelace', decimals: 6 },
                { id: tokenId, decimals: 2 },
                '600000000',
                '10000'
              ),
              pool(
                { id: tokenId, decimals: 2 },
                { id: 'other.asset', decimals: 6 },
                '10000',
                '999999999'
              ),
            ],
          },
        },
      })
    );

    const quote = await new SundaeSwapPriceProvider().getTokenAdaQuote(token);

    // Pool prices are 2 and 6 ADA with weights 400 and 1200 ADA.
    expect(quote.priceAda).toBeCloseTo(5);
    expect(quote.liquidityAda).toBe(1600);
    expect(quote.poolsUsed).toBe(2);
  });

  it('keeps a valid pool quote finite when weighted products would overflow', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      response({
        data: {
          pools: {
            byAsset: [
              pool(
                { id: tokenId, decimals: 0 },
                { id: 'ada.lovelace', decimals: 6 },
                '1',
                '1e306'
              ),
            ],
          },
        },
      })
    );

    const quote = await new SundaeSwapPriceProvider().getTokenAdaQuote(token);

    expect(Number.isFinite(quote.priceAda)).toBe(true);
    expect(quote.priceAda).toBeGreaterThan(0);
  });

  it('excludes malformed, empty, non-direct, and non-positive pools', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      response({
        data: {
          pools: {
            byAsset: [
              null,
              pool(
                { id: tokenId, decimals: 0 },
                { id: 'ada.lovelace', decimals: 6 },
                '0',
                '1000000'
              ),
              pool(
                { id: tokenId, decimals: 0 },
                { id: 'other.asset', decimals: 6 },
                '100',
                '1000000'
              ),
              { assetA: { id: tokenId, decimals: 0 }, assetB: null, current: null },
              {
                current: {
                  quantityA: { quantity: '100', asset: { id: tokenId, decimals: null } },
                  quantityB: {
                    quantity: '1000000',
                    asset: { id: 'ada.lovelace', decimals: 6 },
                  },
                },
              },
              {
                current: {
                  quantityA: { quantity: true, asset: { id: tokenId, decimals: 0 } },
                  quantityB: {
                    quantity: '1000000',
                    asset: { id: 'ada.lovelace', decimals: 6 },
                  },
                },
              },
            ],
          },
        },
      })
    );

    await expect(new SundaeSwapPriceProvider().getTokenAdaQuote(token)).rejects.toThrow(
      'SundaeSwap price API schema error: no valid direct ADA pools'
    );
  });

  it('reports HTTP errors contextually', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(response({}, false, 502));

    await expect(new SundaeSwapPriceProvider().getTokenAdaQuote(token)).rejects.toThrow(
      'SundaeSwap price API HTTP error: 502'
    );
  });

  it('reports GraphQL errors contextually', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      response({ errors: [{ message: 'resolver unavailable' }] })
    );

    await expect(new SundaeSwapPriceProvider().getTokenAdaQuote(token)).rejects.toThrow(
      'SundaeSwap price API GraphQL error: resolver unavailable'
    );
  });

  it.each([null, {}, { data: {} }, { data: { pools: { byAsset: null } } }])(
    'rejects malformed response shapes %#',
    async body => {
      (global.fetch as jest.Mock).mockResolvedValue(response(body));

      await expect(new SundaeSwapPriceProvider().getTokenAdaQuote(token)).rejects.toThrow(
        'SundaeSwap price API schema error'
      );
    }
  );

  it('reports JSON parsing failures contextually', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockRejectedValue(new SyntaxError('invalid JSON')),
    });

    await expect(new SundaeSwapPriceProvider().getTokenAdaQuote(token)).rejects.toThrow(
      'SundaeSwap price API schema error: invalid JSON'
    );
  });

  it('reports network failures contextually', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('connection reset'));

    await expect(new SundaeSwapPriceProvider().getTokenAdaQuote(token)).rejects.toThrow(
      'SundaeSwap price API network error: connection reset'
    );
  });
});
