import {
  CardanoDexPriceProvider,
  CardanoDexPriceQuote,
  CardanoPriceService,
} from '../../../../core/price-aggregation';

function provider(
  id: CardanoDexPriceQuote['provider'],
  result: Partial<CardanoDexPriceQuote> | Error
): jest.Mocked<CardanoDexPriceProvider> {
  const promise =
    result instanceof Error
      ? Promise.reject(result)
      : Promise.resolve({
          provider: id,
          priceAda: 0.5,
          liquidityAda: 100,
          poolsUsed: 1,
          timestamp: new Date('2026-09-07T00:00:00Z'),
          ...result,
        });
  return {
    id,
    getTokenAdaQuote: jest.fn().mockReturnValue(promise),
  };
}

function mockAdaUsd(...prices: Array<number | Error>): void {
  const values = prices.length > 0 ? prices : [0.45, 0.45, 0.45, 0.45];
  for (const value of values) {
    if (value instanceof Error) {
      (global.fetch as jest.Mock).mockRejectedValueOnce(value);
    } else {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          price: String(value),
          cardano: { usd: value },
          result: { ADAUSD: { c: [String(value)] } },
        }),
      });
    }
  }
}

describe('CardanoPriceService', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  describe('getTokenPrice', () => {
    it('liquidity-weights Minswap and SundaeSwap quotes and multiplies by ADA/USD', async () => {
      const minswap = provider('minswap', { priceAda: 0.4, liquidityAda: 100 });
      const sundaeswap = provider('sundaeswap', { priceAda: 0.6, liquidityAda: 300 });
      mockAdaUsd();

      const result = await new CardanoPriceService([minswap, sundaeswap]).getTokenPrice('INDY');

      expect(minswap.getTokenAdaQuote).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: 'INDY' })
      );
      expect(sundaeswap.getTokenAdaQuote).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: 'INDY' })
      );
      expect(result.symbol).toBe('INDY/USDT');
      expect(result.price).toBeCloseTo(0.55 * 0.45);
      expect(result.confidence).toBeLessThan(0.9);
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.sources.map(source => source.id)).toEqual(['minswap', 'sundaeswap', 'cex-ada']);
    });

    it('uses Minswap alone when SundaeSwap fails', async () => {
      const minswap = provider('minswap', { priceAda: 0.5, liquidityAda: 100 });
      const sundaeswap = provider('sundaeswap', new Error('GraphQL unavailable'));
      mockAdaUsd();

      const result = await new CardanoPriceService([minswap, sundaeswap]).getTokenPrice('INDY');

      expect(result.price).toBeCloseTo(0.5 * 0.45);
      expect(result.confidence).toBe(0.7);
      expect(result.sources.map(source => source.id)).toEqual(['minswap', 'cex-ada']);
    });

    it('uses SundaeSwap alone when Minswap fails', async () => {
      const minswap = provider('minswap', new Error('REST unavailable'));
      const sundaeswap = provider('sundaeswap', { priceAda: 0.6, liquidityAda: 200 });
      mockAdaUsd();

      const result = await new CardanoPriceService([minswap, sundaeswap]).getTokenPrice('SNEK');

      expect(result.price).toBeCloseTo(0.6 * 0.45);
      expect(result.confidence).toBe(0.7);
      expect(result.sources.map(source => source.id)).toEqual(['sundaeswap', 'cex-ada']);
    });

    it('uses 0.90 confidence when two providers agree', async () => {
      const minswap = provider('minswap', { priceAda: 0.5, liquidityAda: 100 });
      const sundaeswap = provider('sundaeswap', { priceAda: 0.5, liquidityAda: 200 });
      mockAdaUsd();

      const result = await new CardanoPriceService([minswap, sundaeswap]).getTokenPrice('INDY');

      expect(result.confidence).toBe(0.9);
    });

    it('keeps the weighted average finite for very large valid quotes', async () => {
      const minswap = provider('minswap', {
        priceAda: Number.MAX_VALUE,
        liquidityAda: Number.MAX_VALUE,
      });
      const sundaeswap = provider('sundaeswap', new Error('unavailable'));
      mockAdaUsd(0.5, 0.5, 0.5, 0.5);

      const result = await new CardanoPriceService([minswap, sundaeswap]).getTokenPrice('INDY');

      expect(Number.isFinite(result.price)).toBe(true);
      expect(result.price).toBeGreaterThan(0);
    });

    it('reduces confidence for extreme finite provider disagreement', async () => {
      const minswap = provider('minswap', { priceAda: 1e308, liquidityAda: 1 });
      const sundaeswap = provider('sundaeswap', {
        priceAda: 1.7e308,
        liquidityAda: 1,
      });
      mockAdaUsd(Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);

      const result = await new CardanoPriceService([minswap, sundaeswap]).getTokenPrice('INDY');

      expect(result.confidence).toBeLessThan(0.9);
    });

    it('rejects a non-finite final TOKEN/USDT price', async () => {
      const minswap = provider('minswap', {
        priceAda: Number.MAX_VALUE,
        liquidityAda: 1,
      });
      const sundaeswap = provider('sundaeswap', new Error('unavailable'));
      mockAdaUsd(2, 2, 2, 2);

      await expect(
        new CardanoPriceService([minswap, sundaeswap]).getTokenPrice('INDY')
      ).rejects.toThrow('Invalid non-finite INDY/USDT price');
    });

    it('categorizes both provider failures and preserves their context', async () => {
      const minswap = provider('minswap', new Error('REST unavailable'));
      const sundaeswap = provider('sundaeswap', new Error('GraphQL unavailable'));
      mockAdaUsd();

      await expect(
        new CardanoPriceService([minswap, sundaeswap]).getTokenPrice('INDY')
      ).rejects.toThrow(
        'Cardano DEX providers unavailable for INDY: minswap: REST unavailable; sundaeswap: GraphQL unavailable'
      );
    });

    it('rejects invalid provider quotes as unavailable', async () => {
      const minswap = provider('minswap', { priceAda: 0, liquidityAda: 100 });
      const sundaeswap = provider('sundaeswap', { priceAda: 1, liquidityAda: 0 });
      mockAdaUsd();

      await expect(
        new CardanoPriceService([minswap, sundaeswap]).getTokenPrice('INDY')
      ).rejects.toThrow('Cardano DEX providers unavailable for INDY');
    });

    it('preserves unsupported-token behavior without calling providers', async () => {
      const minswap = provider('minswap', {});
      const sundaeswap = provider('sundaeswap', {});

      await expect(
        new CardanoPriceService([minswap, sundaeswap]).getTokenPrice('UNSUPPORTED')
      ).rejects.toThrow('Unsupported token: UNSUPPORTED');
      expect(minswap.getTokenAdaQuote).not.toHaveBeenCalled();
      expect(sundaeswap.getTokenAdaQuote).not.toHaveBeenCalled();
    });

    it('preserves CEX fallback behavior', async () => {
      const minswap = provider('minswap', { priceAda: 0.5 });
      const sundaeswap = provider('sundaeswap', new Error('unavailable'));
      mockAdaUsd(new Error('Binance down'), new Error('MEXC down'), 0.42, new Error('Kraken down'));

      const result = await new CardanoPriceService([minswap, sundaeswap]).getTokenPrice('INDY');

      expect(result.price).toBeCloseTo(0.5 * 0.42);
      expect(result.sources[1]).toMatchObject({ id: 'cex-ada', exchange: 'multi-cex-1' });
    });

    it('fails price aggregation when all CEX APIs fail', async () => {
      const minswap = provider('minswap', {});
      const sundaeswap = provider('sundaeswap', {});
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(
        new CardanoPriceService([minswap, sundaeswap]).getTokenPrice('INDY')
      ).rejects.toThrow('Price aggregation failed for INDY');
    });
  });

  describe('private fetchADAUSDT method', () => {
    let service: CardanoPriceService;

    beforeEach(() => {
      service = new CardanoPriceService([]);
    });

    it.each([
      ['binance', { price: '0.4567' }, 0.4567],
      ['mexc', { price: '0.4568' }, 0.4568],
      ['coingecko', { cardano: { usd: 0.4569 } }, 0.4569],
      ['kraken', { result: { ADAUSD: { c: ['0.4570'] } } }, 0.457],
    ])('parses %s API responses', async (exchange, body, expected) => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => body });

      await expect((service as any).fetchADAUSDT(exchange)).resolves.toBe(expected);
    });

    it('rejects HTTP error responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 429 });

      await expect((service as any).fetchADAUSDT('binance')).rejects.toThrow(
        'binance API error: 429'
      );
    });

    it.each(['invalid', '0', '-1'])('rejects invalid price %s', async price => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ price }),
      });

      await expect((service as any).fetchADAUSDT('binance')).rejects.toThrow(
        'Invalid price from binance'
      );
    });
  });
});
