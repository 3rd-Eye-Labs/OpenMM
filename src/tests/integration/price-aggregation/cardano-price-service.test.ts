/**
 * Live integration tests for Cardano pricing through Minswap and SundaeSwap.
 */
import { CardanoPriceService } from '../../../core/price-aggregation';
import { isTokenSupported, getSupportedTokens } from '../../../config/price-aggregation';

const dexSourceIds = ['minswap', 'sundaeswap'];

function expectLivePrice(
  symbol: string,
  price: Awaited<ReturnType<CardanoPriceService['getTokenPrice']>>
) {
  expect(price.symbol).toBe(`${symbol}/USDT`);
  expect(Number.isFinite(price.price)).toBe(true);
  expect(price.price).toBeGreaterThan(0);
  expect(price.confidence).toBeGreaterThan(0);
  expect(price.timestamp).toBeInstanceOf(Date);
  expect(price.sources.some(source => dexSourceIds.includes(source.id))).toBe(true);
  expect(price.sources.some(source => source.id.includes('iris'))).toBe(false);
}

describe('CardanoPriceService Integration', () => {
  let priceService: CardanoPriceService;

  beforeEach(() => {
    priceService = new CardanoPriceService();
  });

  describe('Token Support', () => {
    test('supports configured tokens', () => {
      expect(isTokenSupported('INDY')).toBe(true);
      expect(isTokenSupported('SNEK')).toBe(true);
      expect(getSupportedTokens()).toEqual(expect.arrayContaining(['INDY', 'SNEK']));
    });

    test('rejects unsupported token', async () => {
      expect(isTokenSupported('UNKNOWN')).toBe(false);
      await expect(priceService.getTokenPrice('UNKNOWN')).rejects.toThrow(
        'Unsupported token: UNKNOWN'
      );
    });
  });

  describe('Live price fetching', () => {
    test('fetches INDY through at least one replacement DEX provider', async () => {
      const price = await priceService.getTokenPrice('INDY');
      expectLivePrice('INDY', price);
    }, 30000);

    test('fetches zero-decimal SNEK through at least one replacement DEX provider', async () => {
      const price = await priceService.getTokenPrice('SNEK');
      expectLivePrice('SNEK', price);
    }, 30000);
  });
});
