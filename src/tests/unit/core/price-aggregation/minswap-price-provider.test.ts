import { MinswapPriceProvider } from '../../../../core/price-aggregation/minswap-price-provider';
import { CardanoTokenConfig } from '../../../../types';

const token: CardanoTokenConfig = {
  symbol: 'INDY',
  policyId: 'policy',
  assetName: '494e4459',
};

const response = (body: unknown, ok = true, status = 200): Response =>
  ({ ok, status, json: jest.fn().mockResolvedValue(body) }) as unknown as Response;

describe('MinswapPriceProvider', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('fetches the concatenated asset metrics without credentials and returns an ADA quote', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(response({ price: '0.25', liquidity: '120000' }));

    const quote = await new MinswapPriceProvider().getTokenAdaQuote(token);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://api-mainnet-prod.minswap.org/v1/assets/policy494e4459/metrics');
    expect(options).toMatchObject({ method: 'GET' });
    expect(options.headers).toBeUndefined();
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(quote).toMatchObject({
      provider: 'minswap',
      priceAda: 0.25,
      liquidityAda: 120000,
      poolsUsed: 1,
    });
    expect(quote.timestamp).toBeInstanceOf(Date);
  });

  it('reports HTTP errors contextually', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(response({}, false, 503));

    await expect(new MinswapPriceProvider().getTokenAdaQuote(token)).rejects.toThrow(
      'Minswap price API HTTP error: 503'
    );
  });

  it.each([
    [{ price: 'not-a-number', liquidity: 10 }],
    [{ price: 0, liquidity: 10 }],
    [{ price: -1, liquidity: 10 }],
    [{ price: 1, liquidity: 0 }],
    [{ price: 1, liquidity: -10 }],
    [{ price: 1 }],
    [{ price: true, liquidity: 10 }],
    [{ price: 1, liquidity: true }],
    [{ price: [1], liquidity: 10 }],
    [{ price: 1, liquidity: [10] }],
    [{ price: '', liquidity: 10 }],
    [{ price: 1, liquidity: '' }],
    [null],
  ])('rejects malformed or non-positive metrics %#', async body => {
    (global.fetch as jest.Mock).mockResolvedValue(response(body));

    await expect(new MinswapPriceProvider().getTokenAdaQuote(token)).rejects.toThrow(
      'Minswap price API schema error'
    );
  });

  it('reports JSON parsing failures contextually', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockRejectedValue(new SyntaxError('invalid JSON')),
    });

    await expect(new MinswapPriceProvider().getTokenAdaQuote(token)).rejects.toThrow(
      'Minswap price API schema error: invalid JSON'
    );
  });

  it('reports network failures contextually', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('connection reset'));

    await expect(new MinswapPriceProvider().getTokenAdaQuote(token)).rejects.toThrow(
      'Minswap price API network error: connection reset'
    );
  });
});
