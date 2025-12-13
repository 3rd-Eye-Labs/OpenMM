import { IrisPoolDiscovery } from '../../../../core/price-aggregation';
import { IrisApiClient } from '../../../../core/price-aggregation';
import { CardanoTokenConfig } from '../../../../types';

jest.mock('../../../../core/price-aggregation/iris-api-client');

describe('IrisPoolDiscovery', () => {
  let poolDiscovery: IrisPoolDiscovery;
  let mockApiClient: jest.Mocked<IrisApiClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    poolDiscovery = new IrisPoolDiscovery();
    mockApiClient = (poolDiscovery as any).irisClient;
  });

  describe('discoverPools', () => {
    const mockTokenConfig: CardanoTokenConfig = {
      symbol: 'INDY',
      policyId: '533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0',
      assetName: '494e4459',
      minLiquidityThreshold: 100000
    };

    it('should discover pools for a token successfully', async () => {
      const mockApiResponse = [
        {
          identifier: 'pool1',
          dex: 'MinswapV2',
          address: 'addr1...',
          tokenA: null,
          tokenB: {
            policyId: '533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0',
            nameHex: '494e4459'
          },
          state: {
            tvl: 1000000,
            reserveA: 1000000,
            reserveB: 500000
          },
          createdSlot: 123
        },
        {
          identifier: 'pool2',
          dex: 'SundaeSwap',
          address: 'addr2...',
          tokenA: null,
          tokenB: {
            policyId: '533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0',
            nameHex: '494e4459'
          },
          state: {
            tvl: 500000,
            reserveA: 800000,
            reserveB: 400000
          },
          createdSlot: 124
        }
      ];

      mockApiClient.fetchLiquidityPools.mockResolvedValue(mockApiResponse);

      const result = await poolDiscovery.discoverPools('lovelace', mockTokenConfig);

      expect(mockApiClient.fetchLiquidityPools).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].dex).toBe('MinswapV2');
      expect(result[0].state?.tvl).toBe(1000000);
      expect(result[1].dex).toBe('SundaeSwap');
      expect(result[1].state?.tvl).toBe(500000);
    });

    it('should filter pools by minimum liquidity threshold', async () => {
      const tokenConfigWithHighThreshold: CardanoTokenConfig = {
        ...mockTokenConfig,
        minLiquidityThreshold: 750000
      };

      const mockApiResponse = [
        {
          identifier: 'pool1',
          dex: 'MinswapV2',
          tokenA: null,
          tokenB: {
            policyId: '533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0',
            nameHex: '494e4459'
          },
          state: { tvl: 1000000, reserveA: 1000000, reserveB: 500000 }
        },
        {
          identifier: 'pool2',
          dex: 'SundaeSwap',
          tokenA: null,
          tokenB: {
            policyId: '533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0',
            nameHex: '494e4459'
          },
          state: { tvl: 500000, reserveA: 800000, reserveB: 400000 }
        }
      ];

      mockApiClient.fetchLiquidityPools.mockResolvedValue(mockApiResponse);

      const result = await poolDiscovery.discoverPools('lovelace', tokenConfigWithHighThreshold);

      expect(result).toHaveLength(1);
      expect(result[0].dex).toBe('MinswapV2');
    });

    it('should handle empty response from API', async () => {
      mockApiClient.fetchLiquidityPools.mockResolvedValue([]);

      await expect(
        poolDiscovery.discoverPools('lovelace', mockTokenConfig)
      ).rejects.toThrow('No liquidity pools found for INDY');
    });

    it('should propagate API client errors', async () => {
      const apiError = new Error('Iris API unavailable');
      mockApiClient.fetchLiquidityPools.mockRejectedValue(apiError);

      await expect(
        poolDiscovery.discoverPools('lovelace', mockTokenConfig)
      ).rejects.toThrow('Pool discovery failed for INDY');
    });

    it('should handle pools without state gracefully', async () => {
      const mockApiResponse = [
        {
          identifier: 'pool1',
          dex: 'MinswapV2',
          tokenA: null,
          tokenB: {
            policyId: '533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0',
            nameHex: '494e4459'
          }
        },
        {
          identifier: 'pool2',
          dex: 'SundaeSwap',
          tokenA: null,
          tokenB: {
            policyId: '533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0',
            nameHex: '494e4459'
          },
          state: {
            tvl: 500000,
            reserveA: 800000,
            reserveB: 400000
          }
        }
      ];

      mockApiClient.fetchLiquidityPools.mockResolvedValue(mockApiResponse);

      const result = await poolDiscovery.discoverPools('lovelace', mockTokenConfig);

      expect(result).toHaveLength(1);
      expect(result[0].dex).toBe('SundaeSwap');
    });

    it('should throw error when no pools meet liquidity threshold', async () => {
      const mockApiResponse = [
        {
          identifier: 'pool1',
          dex: 'MinswapV2',
          tokenA: null,
          tokenB: {
            policyId: '533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0',
            nameHex: '494e4459'
          },
          state: { tvl: 50000, reserveA: 1000000, reserveB: 500000 }
        }
      ];

      mockApiClient.fetchLiquidityPools.mockResolvedValue(mockApiResponse);

      await expect(
        poolDiscovery.discoverPools('lovelace', mockTokenConfig)
      ).rejects.toThrow('No pools meet minimum liquidity threshold for INDY');
    });

    it('should not filter when no minimum liquidity threshold is set', async () => {
      const tokenConfigNoThreshold: CardanoTokenConfig = {
        symbol: 'INDY',
        policyId: '533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0',
        assetName: '494e4459'
      };

      const mockApiResponse = [
        {
          identifier: 'pool1',
          dex: 'MinswapV2',
          tokenA: null,
          tokenB: {
            policyId: '533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0',
            nameHex: '494e4459'
          },
          state: { tvl: 1000, reserveA: 1000000, reserveB: 500000 }
        },
        {
          identifier: 'pool2',
          dex: 'SundaeSwap',
          tokenA: null,
          tokenB: {
            policyId: '533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0',
            nameHex: '494e4459'
          },
          state: { tvl: 500000, reserveA: 800000, reserveB: 400000 }
        }
      ];

      mockApiClient.fetchLiquidityPools.mockResolvedValue(mockApiResponse);

      const result = await poolDiscovery.discoverPools('lovelace', tokenConfigNoThreshold);

      expect(result).toHaveLength(2);
    });

    it('should sort pools by TVL in descending order', async () => {
      const mockApiResponse = [
        {
          identifier: 'pool1',
          dex: 'SmallerPool',
          tokenA: null,
          tokenB: {
            policyId: '533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0',
            nameHex: '494e4459'
          },
          state: { tvl: 300000, reserveA: 600000, reserveB: 300000 }
        },
        {
          identifier: 'pool2',
          dex: 'LargerPool',
          tokenA: null,
          tokenB: {
            policyId: '533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0',
            nameHex: '494e4459'
          },
          state: { tvl: 800000, reserveA: 1600000, reserveB: 800000 }
        }
      ];

      mockApiClient.fetchLiquidityPools.mockResolvedValue(mockApiResponse);

      const result = await poolDiscovery.discoverPools('lovelace', mockTokenConfig);

      expect(result).toHaveLength(2);
      expect(result[0].dex).toBe('LargerPool');
      expect(result[0].state?.tvl).toBe(800000);
      expect(result[1].dex).toBe('SmallerPool');
      expect(result[1].state?.tvl).toBe(300000);
    });
  });
});