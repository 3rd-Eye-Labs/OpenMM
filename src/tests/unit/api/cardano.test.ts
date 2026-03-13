import { createApiServer } from '../../../api/server';
import { FastifyInstance } from 'fastify';
import { CardanoPriceService } from '../../../core/price-aggregation/cardano-price-service';
import { IrisPoolDiscovery } from '../../../core/price-aggregation/iris-pool-discovery';

jest.mock('../../../core/price-aggregation/cardano-price-service');
jest.mock('../../../core/price-aggregation/iris-pool-discovery');

describe('Cardano Routes', () => {
  let app: FastifyInstance;
  const mockGetTokenPrice = jest.fn();
  const mockDiscoverPools = jest.fn();

  beforeAll(async () => {
    (CardanoPriceService as jest.Mock).mockImplementation(() => ({
      getTokenPrice: mockGetTokenPrice,
    }));
    (IrisPoolDiscovery as jest.Mock).mockImplementation(() => ({
      discoverPools: mockDiscoverPools,
    }));
    app = await createApiServer({ enableSwagger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/cardano/price/:symbol', () => {
    it('should return token price', async () => {
      mockGetTokenPrice.mockResolvedValue({
        symbol: 'SNEK/USDT',
        price: 0.00012,
        confidence: 0.95,
        timestamp: new Date(),
        sources: [
          { id: 'iris-dex', name: 'Iris DEX Aggregator', exchange: 'cardano' },
        ],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/cardano/price/SNEK',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.symbol).toBe('SNEK/USDT');
      expect(body.price).toBe(0.00012);
      expect(body.confidence).toBe(0.95);
      expect(body.sources).toHaveLength(1);
      expect(body.timestamp).toBeDefined();
    });

    it('should handle case-insensitive symbol', async () => {
      mockGetTokenPrice.mockResolvedValue({
        symbol: 'INDY/USDT',
        price: 0.5,
        confidence: 0.9,
        timestamp: new Date(),
        sources: [],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/cardano/price/indy',
      });

      expect(response.statusCode).toBe(200);
      expect(mockGetTokenPrice).toHaveBeenCalledWith('INDY');
    });

    it('should return 400 for unsupported token', async () => {
      mockGetTokenPrice.mockRejectedValue(new Error('Unsupported token: INVALID'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/cardano/price/INVALID',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Unsupported token');
    });

    it('should return 500 for other errors', async () => {
      mockGetTokenPrice.mockRejectedValue(new Error('Network error'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/cardano/price/SNEK',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Failed to fetch price');
    });
  });

  describe('GET /api/v1/cardano/pools/:symbol', () => {
    it('should return liquidity pools for a token', async () => {
      mockDiscoverPools.mockResolvedValue([
        {
          dex: 'Minswap',
          identifier: 'pool-1',
          state: { tvl: 500000, price: 0.5, reserveA: 100000, reserveB: 200000 },
          pair: { tokenA: { ticker: 'ADA' }, tokenB: { ticker: 'INDY' } },
        },
        {
          dex: 'SundaeSwap',
          identifier: 'pool-2',
          state: { tvl: 250000, price: 0.48, reserveA: 50000, reserveB: 104000 },
          pair: { tokenA: { ticker: 'ADA' }, tokenB: { ticker: 'INDY' } },
        },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/cardano/pools/INDY',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.symbol).toBe('INDY');
      expect(body.pools).toHaveLength(2);
      expect(body.pools[0].dex).toBe('Minswap');
      expect(body.pools[0].tvl).toBe(500000);
      expect(body.count).toBe(2);
    });

    it('should respect limit parameter', async () => {
      mockDiscoverPools.mockResolvedValue([
        { dex: 'Minswap', identifier: 'pool-1', state: { tvl: 500000 }, pair: {} },
        { dex: 'SundaeSwap', identifier: 'pool-2', state: { tvl: 250000 }, pair: {} },
        { dex: 'WingRiders', identifier: 'pool-3', state: { tvl: 100000 }, pair: {} },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/cardano/pools/SNEK?limit=2',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.pools).toHaveLength(2);
      expect(body.count).toBe(2);
    });

    it('should return 400 for unsupported token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/cardano/pools/INVALID',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Unsupported token');
    });

    it('should return 500 when pool discovery fails', async () => {
      mockDiscoverPools.mockRejectedValue(new Error('Iris API unavailable'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/cardano/pools/INDY',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Failed to discover pools');
    });
  });
});
