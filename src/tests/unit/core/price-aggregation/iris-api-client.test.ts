import { IrisApiClient } from '../../../../core/price-aggregation';
import { LiquidityPool } from '../../../../types';

global.fetch = jest.fn();

describe('IrisApiClient', () => {
  let apiClient: IrisApiClient;

  beforeEach(() => {
    jest.clearAllMocks();
    apiClient = new IrisApiClient();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('fetchLiquidityPools', () => {
    it('should fetch pools successfully', async () => {
      const mockPools: LiquidityPool[] = [
        {
          dex: 'MinswapV2',
          identifier: 'pool1',
          address: 'addr1...',
          state: {
            tvl: 1000000,
            reserveA: 1000000,
            reserveB: 500000,
          },
          isActive: true,
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockPools }),
      });

      const result = await apiClient.fetchLiquidityPools();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://iris.indigoprotocol.io/api/liquidity-pools',
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'OpenMM-PriceAggregator/1.0',
          },
        })
      );
      expect(result).toEqual(mockPools);
    });

    it('should handle HTTP errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(apiClient.fetchLiquidityPools()).rejects.toThrow(
        'Iris API error: 500 Internal Server Error'
      );
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(apiClient.fetchLiquidityPools()).rejects.toThrow('Network error');
    });

    it('should handle empty response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const result = await apiClient.fetchLiquidityPools();
      expect(result).toEqual([]);
    });
  });

  describe('fetchPrices', () => {
    it('should fetch prices for pool identifiers successfully', async () => {
      const mockResponse = [{ price: '0.5' }, { price: '0.6' }, { price: '0.55' }];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const identifiers = ['pool1', 'pool2', 'pool3'];
      const result = await apiClient.fetchPrices(identifiers, 'TestAgent/1.0');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://iris.indigoprotocol.io/api/liquidity-pools/prices',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'TestAgent/1.0',
          },
          body: JSON.stringify({
            identifiers: identifiers,
          }),
        }
      );
      expect(result).toEqual([0.5, 0.6, 0.55]);
    });

    it('should use default user agent when none provided', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [{ price: '0.5' }],
      });

      const result = await apiClient.fetchPrices(['pool1']);

      expect(result).toEqual([0.5]);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://iris.indigoprotocol.io/api/liquidity-pools/prices',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'OpenMM-PriceAggregator/1.0',
          },
          body: JSON.stringify({
            identifiers: ['pool1'],
          }),
        }
      );
    });

    it('should handle empty identifier array', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      await expect(apiClient.fetchPrices([])).rejects.toThrow(
        'Invalid response format from Iris prices API'
      );
    });

    it('should handle HTTP errors for price fetching', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(apiClient.fetchPrices(['invalid-pool'])).rejects.toThrow(
        'Iris prices API error: 404 Not Found'
      );
    });

    it('should handle network errors for price fetching', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Connection timeout'));

      await expect(apiClient.fetchPrices(['pool1'])).rejects.toThrow('Connection timeout');
    });

    it('should handle non-array response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ error: 'Invalid request' }),
      });

      await expect(apiClient.fetchPrices(['pool1'])).rejects.toThrow(
        'Invalid response format from Iris prices API'
      );
    });

    it('should handle array with non-numeric values', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [{ price: '0.5' }, { price: 'invalid' }, { price: '0.6' }],
      });

      await expect(apiClient.fetchPrices(['pool1', 'pool2', 'pool3'])).rejects.toThrow(
        'Invalid price value: invalid'
      );
    });

    it('should handle large identifier arrays', async () => {
      const largeArray = Array.from({ length: 100 }, (_, i) => `pool${i}`);
      const largePriceResponse = Array.from({ length: 100 }, (_, i) => ({
        price: (0.5 + i * 0.01).toString(),
      }));

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => largePriceResponse,
      });

      const result = await apiClient.fetchPrices(largeArray);

      expect(result).toHaveLength(100);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://iris.indigoprotocol.io/api/liquidity-pools/prices',
        expect.objectContaining({
          body: JSON.stringify({
            identifiers: largeArray,
          }),
        })
      );
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle undefined/null responses gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => null,
      });

      const result = await apiClient.fetchLiquidityPools();
      expect(result).toEqual([]);
    });
  });
});
