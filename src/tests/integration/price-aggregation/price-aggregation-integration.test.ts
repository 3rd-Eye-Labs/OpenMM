import { CardanoPriceService } from '../../../core/price-aggregation';

describe('Price Aggregation Integration Tests', () => {
  let priceService: CardanoPriceService;

  beforeAll(() => {
    priceService = new CardanoPriceService();
  });

  afterAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 100));

    priceService = null as any;

    if (global.gc) {
      global.gc();
    }
  });

  describe('Real API Integration', () => {
    it('should get real price for MIN token', async () => {
      let retryCount = 0;
      let result = undefined;
      
      // Retry logic for network issues
      while (retryCount < 3) {
        try {
          result = await priceService.getTokenPrice('MIN');
          break; // Success, exit retry loop
        } catch (error) {
          retryCount++;
          if (retryCount >= 3) {
            throw error; // Re-throw after max retries
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      expect(result).toBeDefined();
      expect(result!.symbol).toBe('MIN/USDT');
      expect(result!.price).toBeGreaterThan(0);
      expect(result!.price).toBeLessThan(1000);
      expect(result!.confidence).toBeGreaterThan(0);
      expect(result!.confidence).toBeLessThanOrEqual(1);
      expect(result!.sources).toHaveLength(2);
      expect(result!.timestamp).toBeInstanceOf(Date);

      const hasIrisSource = result!.sources.some(s => s.exchange === 'cardano');
      const hasCexSource = result!.sources.some(s => s.exchange.includes('cex'));
      expect(hasIrisSource).toBe(true);
      expect(hasCexSource).toBe(true);
    }, 60000);

    it('should get real price for INDY token', async () => {
      const result = await priceService.getTokenPrice('INDY');

      expect(result.symbol).toBe('INDY/USDT');
      expect(result.price).toBeGreaterThan(0);
      expect(result.price).toBeLessThan(100);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.sources).toHaveLength(2);
    }, 60000);

    it('should get real price for SNEK token', async () => {
      const result = await priceService.getTokenPrice('SNEK');

      expect(result.symbol).toBe('SNEK/USDT');
      expect(result.price).toBeGreaterThan(0);
      expect(result.price).toBeLessThan(10000);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.sources).toHaveLength(2);
    }, 60000);

    it('should handle price comparison between tokens', async () => {
      const [minPrice, indyPrice] = await Promise.all([
        priceService.getTokenPrice('MIN'),
        priceService.getTokenPrice('INDY'),
      ]);

      expect(minPrice.price).toBeGreaterThan(0);
      expect(indyPrice.price).toBeGreaterThan(0);

      expect(minPrice.price).not.toBe(indyPrice.price);

      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;
      expect(minPrice.timestamp.getTime()).toBeGreaterThan(fiveMinutesAgo);
      expect(indyPrice.timestamp.getTime()).toBeGreaterThan(fiveMinutesAgo);
    }, 60000);

    it('should maintain price stability over short intervals', async () => {
      const price1 = await priceService.getTokenPrice('MIN');

      await new Promise(resolve => setTimeout(resolve, 2000));

      const price2 = await priceService.getTokenPrice('MIN');

      const priceChange = Math.abs(price2.price - price1.price) / price1.price;
      expect(priceChange).toBeLessThan(0.05);

      const confidenceChange = Math.abs(price2.confidence - price1.confidence);
      expect(confidenceChange).toBeLessThan(0.3);
    }, 45000);
  });

  describe('Error Handling Integration', () => {
    it('should handle unsupported token gracefully', async () => {
      await expect(priceService.getTokenPrice('NONEXISTENT')).rejects.toThrow(
        'Unsupported token: NONEXISTENT'
      );
    });

    it('should handle invalid token symbols', async () => {
      const invalidTokens = ['', '   ', 'INVALID123', 'too-long-token-symbol'];

      for (const token of invalidTokens) {
        await expect(priceService.getTokenPrice(token)).rejects.toThrow();
      }
    });
  });

  describe('Performance Tests', () => {
    it('should complete price aggregation within reasonable time', async () => {
      const startTime = Date.now();

      await priceService.getTokenPrice('MIN');

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(15000);
    }, 20000);

    it('should handle concurrent price requests efficiently', async () => {
      const startTime = Date.now();

      const promises = [
        priceService.getTokenPrice('MIN'),
        priceService.getTokenPrice('INDY'),
        priceService.getTokenPrice('SNEK'),
      ];

      const results = await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(25000);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.price).toBeGreaterThan(0);
        expect(result.confidence).toBeGreaterThan(0);
      });
    }, 60000);
  });

  describe('Data Quality Tests', () => {
    it('should return prices within expected ranges for known tokens', async () => {
      const minResult = await priceService.getTokenPrice('MIN');
      const indyResult = await priceService.getTokenPrice('INDY');
      const snekResult = await priceService.getTokenPrice('SNEK');

      // Updated price ranges based on current market conditions
      expect(minResult.price).toBeGreaterThan(0.001); // MIN: Updated range
      expect(minResult.price).toBeLessThan(1000);

      expect(indyResult.price).toBeGreaterThan(0.001); // INDY: Updated range
      expect(indyResult.price).toBeLessThan(1000);

      expect(snekResult.price).toBeGreaterThan(0.0005); // SNEK: Updated range for current market
      expect(snekResult.price).toBeLessThan(10000);
    }, 45000);

    it('should have reasonable confidence scores', async () => {
      const result = await priceService.getTokenPrice('MIN');

      expect(result.confidence).toBeGreaterThanOrEqual(0.3);
      expect(result.confidence).toBeLessThanOrEqual(0.95);

      expect(result.confidence).toBeGreaterThan(0.4);
    }, 60000);

    it('should provide complete source information', async () => {
      const result = await priceService.getTokenPrice('MIN');

      expect(result.sources).toHaveLength(2);

      result.sources.forEach(source => {
        expect(source.id).toBeDefined();
        expect(source.name).toBeDefined();
        expect(source.exchange).toBeDefined();
        expect(source.reliability).toBeGreaterThan(0);
        expect(source.reliability).toBeLessThanOrEqual(1);
        expect(typeof source.isActive).toBe('boolean');
        expect(source.latency).toBeGreaterThanOrEqual(0);
      });
    }, 60000);
  });
});
