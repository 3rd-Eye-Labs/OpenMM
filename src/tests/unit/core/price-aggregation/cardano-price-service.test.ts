import { CardanoPriceService } from '../../../../core/price-aggregation';
import { IrisPoolDiscovery } from '../../../../core/price-aggregation';
import { IrisApiClient } from '../../../../core/price-aggregation';
import { PriceCalculator } from '../../../../core/price-aggregation/price-calculator';
import { LiquidityPool, PriceCalculationResult } from '../../../../types';

jest.mock('../../../../core/price-aggregation/iris-pool-discovery');
jest.mock('../../../../core/price-aggregation/iris-api-client');
jest.mock('../../../../core/price-aggregation/price-calculator');

global.fetch = jest.fn();

describe('CardanoPriceService', () => {
  let service: CardanoPriceService;
  let mockPoolDiscovery: jest.Mocked<IrisPoolDiscovery>;
  let mockIrisClient: jest.Mocked<IrisApiClient>;
  let mockPriceCalculator: jest.Mocked<PriceCalculator>;

  beforeEach(() => {
    jest.clearAllMocks();

    (global.fetch as jest.Mock).mockClear();

    service = new CardanoPriceService();
    mockPoolDiscovery = (service as any).poolDiscovery;
    mockIrisClient = (service as any).irisClient;
    mockPriceCalculator = (service as any).priceCalculator;
  });

  describe('getTokenPrice', () => {
    it('should return aggregated price for supported token', async () => {
      const mockPools: LiquidityPool[] = [
        {
          dex: 'MinswapV2',
          identifier: 'pool1',
          state: { tvl: 1000000, reserveA: 1000000, reserveB: 500000 },
        },
      ];
      mockPoolDiscovery.discoverPools.mockResolvedValue(mockPools);
      mockIrisClient.fetchPrices.mockResolvedValue([0.5]);

      const mockPriceResult: PriceCalculationResult = {
        price: 0.5,
        confidence: 0.8,
        poolsUsed: 1,
        totalLiquidity: 1000000,
        timestamp: new Date(),
      };
      mockPriceCalculator.calculateLiquidityWeightedPrice.mockReturnValue(mockPriceResult);

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ price: '0.45' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ price: '0.46' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cardano: { usd: 0.44 } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: { ADAUSD: { c: ['0.47'] } } }),
        });

      const result = await service.getTokenPrice('INDY');

      expect(result.symbol).toBe('INDY/USDT');
      expect(result.price).toBeCloseTo(0.5 * 0.455, 3);
      expect(result.confidence).toBe(0.8);
      expect(result.sources).toHaveLength(2);
      expect(result.sources[0].name).toBe('Iris DEX Aggregator');
      expect(result.sources[1].name).toBe('CEX ADA/USDT');
    });

    it('should throw error for unsupported token', async () => {
      await expect(service.getTokenPrice('UNSUPPORTED')).rejects.toThrow(
        'Unsupported token: UNSUPPORTED'
      );
    });

    it('should throw error when no pools found', async () => {
      mockPoolDiscovery.discoverPools.mockResolvedValue([]);

      await expect(service.getTokenPrice('INDY')).rejects.toThrow('No pools found for INDY');
    });

    it('should throw error when no valid pools with liquidity', async () => {
      const mockPools: LiquidityPool[] = [
        {
          dex: 'MinswapV2',
          identifier: 'pool1',
        },
      ];
      mockPoolDiscovery.discoverPools.mockResolvedValue(mockPools);

      await expect(service.getTokenPrice('INDY')).rejects.toThrow(
        'No valid pools with liquidity found for INDY'
      );
    });

    it('should handle CEX API failures gracefully', async () => {
      const mockPools: LiquidityPool[] = [
        {
          dex: 'MinswapV2',
          identifier: 'pool1',
          state: { tvl: 1000000, reserveA: 1000000, reserveB: 500000 },
        },
      ];
      mockPoolDiscovery.discoverPools.mockResolvedValue(mockPools);
      mockIrisClient.fetchPrices.mockResolvedValue([0.5]); // Mock Iris API price

      const mockPriceResult: PriceCalculationResult = {
        price: 0.5,
        confidence: 0.8,
        poolsUsed: 1,
        totalLiquidity: 1000000,
        timestamp: new Date(),
      };
      mockPriceCalculator.calculateLiquidityWeightedPrice.mockReturnValue(mockPriceResult);

      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Binance API down'))
        .mockRejectedValueOnce(new Error('MEXC API down'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cardano: { usd: 0.45 } }),
        })
        .mockRejectedValueOnce(new Error('Kraken API down'));

      const result = await service.getTokenPrice('INDY');

      expect(result.price).toBeCloseTo(0.5 * 0.45, 3);
      expect(result.sources[1].name).toBe('CEX ADA/USDT');
      expect(result.sources[1].exchange).toBe('multi-cex-1');
    });

    it('should throw error when all CEX APIs fail', async () => {
      mockPoolDiscovery.discoverPools.mockRejectedValue(
        new Error(
          "Failed to get INDY/ADA price from Iris: Cannot read properties of undefined (reading 'price')"
        )
      );

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(service.getTokenPrice('INDY')).rejects.toThrow(
        'Price aggregation failed for INDY'
      );
    });
  });

  describe('private fetchADAUSDT method', () => {
    it('should parse Binance API response correctly', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ price: '0.4567' }),
      });

      const price = await (service as any).fetchADAUSDT('binance');
      expect(price).toBe(0.4567);
    });

    it('should parse MEXC API response correctly', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ price: '0.4568' }),
      });

      const price = await (service as any).fetchADAUSDT('mexc');
      expect(price).toBe(0.4568);
    });

    it('should parse CoinGecko API response correctly', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ cardano: { usd: 0.4569 } }),
      });

      const price = await (service as any).fetchADAUSDT('coingecko');
      expect(price).toBe(0.4569);
    });

    it('should parse Kraken API response correctly', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          result: { ADAUSD: { c: ['0.4570'] } },
        }),
      });

      const price = await (service as any).fetchADAUSDT('kraken');
      expect(price).toBe(0.457);
    });

    it('should throw error for HTTP error responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
      });

      await expect((service as any).fetchADAUSDT('binance')).rejects.toThrow(
        'binance API error: 429'
      );
    });

    it('should throw error for invalid price data', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ price: 'invalid' }),
      });

      await expect((service as any).fetchADAUSDT('binance')).rejects.toThrow(
        'Invalid price from binance'
      );
    });

    it('should throw error for zero or negative prices', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ price: '0' }),
      });

      await expect((service as any).fetchADAUSDT('binance')).rejects.toThrow(
        'Invalid price from binance'
      );
    });
  });
});
