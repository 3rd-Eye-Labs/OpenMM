import { createApiServer } from '../../../api/server';
import { FastifyInstance } from 'fastify';
import { ExchangeFactory } from '../../../cli/exchange-factory';

jest.mock('../../../cli/exchange-factory', () => ({
  ExchangeFactory: {
    getExchange: jest.fn(),
  },
}));

describe('Trades Routes', () => {
  let app: FastifyInstance;
  const mockGetRecentTrades = jest.fn();

  beforeAll(async () => {
    app = await createApiServer({ enableSwagger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (ExchangeFactory.getExchange as jest.Mock).mockResolvedValue({
      getRecentTrades: mockGetRecentTrades,
    });
  });

  describe('GET /api/v1/trades', () => {
    it('should return recent trades with summary', async () => {
      mockGetRecentTrades.mockResolvedValue([
        { id: '1', symbol: 'BTC/USDT', side: 'buy', price: 42000, amount: 1.0, timestamp: 1699900000000 },
        { id: '2', symbol: 'BTC/USDT', side: 'sell', price: 42001, amount: 0.5, timestamp: 1699900001000 },
        { id: '3', symbol: 'BTC/USDT', side: 'buy', price: 42002, amount: 0.3, timestamp: 1699900002000 },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/trades?exchange=mexc&symbol=BTC/USDT',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.exchange).toBe('mexc');
      expect(body.symbol).toBe('BTC/USDT');
      expect(body.trades).toHaveLength(3);
      expect(body.trades[0].cost).toBe(42000); // price * amount
      expect(body.summary.totalTrades).toBe(3);
      expect(body.summary.buyCount).toBe(2);
      expect(body.summary.sellCount).toBe(1);
      expect(body.summary.buyVolume).toBe(1.3);
      expect(body.summary.sellVolume).toBe(0.5);
    });

    it('should respect limit parameter', async () => {
      mockGetRecentTrades.mockResolvedValue(
        Array(100).fill(null).map((_, i) => ({
          id: String(i),
          symbol: 'BTC/USDT',
          side: 'buy',
          price: 42000,
          amount: 1,
          timestamp: 1699900000000 + i,
        }))
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/trades?exchange=mexc&symbol=BTC/USDT&limit=10',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.trades).toHaveLength(10);
    });

    it('should return 400 for missing parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/trades?exchange=mexc',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should calculate average price correctly', async () => {
      mockGetRecentTrades.mockResolvedValue([
        { id: '1', symbol: 'TEST/USDT', side: 'buy', price: 100, amount: 1.0, timestamp: 1699900000000 },
        { id: '2', symbol: 'TEST/USDT', side: 'buy', price: 200, amount: 1.0, timestamp: 1699900001000 },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/trades?exchange=mexc&symbol=TEST/USDT',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.summary.avgPrice).toBe(150); // (100*1 + 200*1) / 2
    });
  });
});
