/**
 * Integration tests for Cardano Price Service
 * Tests the complete price aggregation flow with Iris API
 */
import { CardanoPriceService } from '../../../core/price-aggregation';
import { isTokenSupported, getSupportedTokens } from '../../../config/price-aggregation';

describe('CardanoPriceService Integration', () => {
  let priceService: CardanoPriceService;
  beforeEach(() => {
    priceService = new CardanoPriceService();
  });

  describe('Token Support', () => {
    test('should support INDY token', () => {
      expect(isTokenSupported('INDY')).toBe(true);
    });

    test('should support SNEK token', () => {
      expect(isTokenSupported('SNEK')).toBe(true);
    });

    test('should not support unsupported token', () => {
      expect(isTokenSupported('UNKNOWN')).toBe(false);
    });

    test('should return list of supported tokens', () => {
      const tokens = getSupportedTokens();
      expect(tokens).toContain('INDY');
      expect(tokens).toContain('SNEK');
      expect(tokens.length).toBeGreaterThan(0);
    });
  });

  describe('Price Fetching', () => {
    test('should reject unsupported token', async () => {
      await expect(priceService.getTokenPrice('UNKNOWN')).rejects.toThrow(
        'Unsupported token: UNKNOWN'
      );
    });

    test('should fetch INDY price successfully', async () => {
      let retryCount = 0;
      let price = undefined;
      
      while (retryCount < 3) {
        try {
          price = await priceService.getTokenPrice('INDY');
          break;
        } catch (error) {
          retryCount++;
          if (retryCount >= 3) {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      expect(price).toBeDefined();
      expect(price!.symbol).toBe('INDY/USDT');
      expect(price!.price).toBeGreaterThan(0);
      expect(price!.confidence).toBeGreaterThan(0);
      expect(price!.timestamp).toBeInstanceOf(Date);
      expect(price!.sources.length).toBeGreaterThan(0);
    }, 60000);

    test('should fetch SNEK price successfully', async () => {
      let retryCount = 0;
      let price = undefined;
      
      // Retry logic for network issues
      while (retryCount < 3) {
        try {
          price = await priceService.getTokenPrice('SNEK');
          break;
        } catch (error) {
          retryCount++;
          if (retryCount >= 3) {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      expect(price).toBeDefined();
      expect(price!.symbol).toBe('SNEK/USDT');
      expect(price!.price).toBeGreaterThan(0);
      expect(price!.confidence).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      jest
        .spyOn(priceService as any, 'getTokenADAPrice')
        .mockRejectedValue(new Error('Network error'));
      await expect(priceService.getTokenPrice('INDY')).rejects.toThrow(
        'Price aggregation failed for INDY'
      );
    });
  });
});
