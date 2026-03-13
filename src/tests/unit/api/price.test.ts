import { createApiServer } from '../../../api/server';
import { FastifyInstance } from 'fastify';
import { ExchangeFactory } from '../../../cli/exchange-factory';

jest.mock('../../../cli/exchange-factory', () => ({
  ExchangeFactory: {
    getExchange: jest.fn(),
  },
}));

describe('Price Routes', () => {
  let app: FastifyInstance;
  const mockGetTicker = jest.fn();

  beforeAll(async () => {
    app = await createApiServer({ enableSwagger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (ExchangeFactory.getExchange as jest.Mock).mockResolvedValue({
      getTicker: mockGetTicker,
    });
  });

  describe('GET /api/v1/price/compare', () => {
    it('should compare prices across exchanges', async () => {
      mockGetTicker.mockResolvedValue({
        symbol: 'BTC/USDT',
        last: 42000,
        bid: 41999,
        ask: 42001,
        baseVolume: 1000,
        timestamp: Date.now(),
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/price/compare?symbol=BTC/USDT',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.symbol).toBe('BTC/USDT');
      expect(body.prices).toBeDefined();
      expect(body.bestBid).toBeDefined();
      expect(body.bestAsk).toBeDefined();
      expect(body.arbitrageOpportunity).toBeDefined();
      expect(body.arbitragePercent).toBeDefined();
    });

    it('should detect arbitrage opportunity', async () => {
      // Mock different prices for different exchanges
      let callCount = 0;
      mockGetTicker.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Exchange 1: Lower ask
          return Promise.resolve({ symbol: 'BTC/USDT', last: 42000, bid: 41990, ask: 42000, baseVolume: 1000, timestamp: Date.now() });
        } else {
          // Exchange 2: Higher bid
          return Promise.resolve({ symbol: 'BTC/USDT', last: 42010, bid: 42010, ask: 42020, baseVolume: 1000, timestamp: Date.now() });
        }
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/price/compare?symbol=BTC/USDT&exchanges=mexc,gateio',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      // Best bid (42010) - best ask (42000) = 10 positive = arbitrage exists
      expect(body.arbitrageOpportunity).toBeGreaterThan(0);
    });

    it('should filter by specified exchanges', async () => {
      mockGetTicker.mockResolvedValue({
        symbol: 'BTC/USDT',
        last: 42000,
        bid: 41999,
        ask: 42001,
        baseVolume: 1000,
        timestamp: Date.now(),
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/price/compare?symbol=BTC/USDT&exchanges=mexc,gateio',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.prices.length).toBeLessThanOrEqual(2);
    });

    it('should return 500 when all exchanges fail', async () => {
      mockGetTicker.mockRejectedValue(new Error('Exchange unavailable'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/price/compare?symbol=INVALID/PAIR',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Failed to fetch prices');
    });

    it('should calculate spread percent correctly', async () => {
      mockGetTicker.mockResolvedValue({
        symbol: 'TEST/USDT',
        last: 100,
        bid: 99,
        ask: 101,
        baseVolume: 1000,
        timestamp: Date.now(),
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/price/compare?symbol=TEST/USDT&exchanges=mexc',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      // Spread = 2, midPrice = 100, spreadPercent = 2%
      expect(body.prices[0].spreadPercent).toBe(2);
    });
  });
});
