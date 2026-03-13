import { createApiServer } from '../../../api/server';
import { FastifyInstance } from 'fastify';
import { ExchangeFactory } from '../../../cli/exchange-factory';

jest.mock('../../../cli/exchange-factory', () => ({
  ExchangeFactory: {
    getExchange: jest.fn(),
  },
}));

describe('Orderbook Routes', () => {
  let app: FastifyInstance;
  const mockGetOrderBook = jest.fn();

  beforeAll(async () => {
    app = await createApiServer({ enableSwagger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (ExchangeFactory.getExchange as jest.Mock).mockResolvedValue({
      getOrderBook: mockGetOrderBook,
    });
  });

  describe('GET /api/v1/orderbook', () => {
    it('should return orderbook with bids and asks', async () => {
      mockGetOrderBook.mockResolvedValue({
        symbol: 'BTC/USDT',
        bids: [
          { price: 42000.0, amount: 1.5 },
          { price: 41999.5, amount: 2.0 },
        ],
        asks: [
          { price: 42001.0, amount: 1.0 },
          { price: 42001.5, amount: 0.5 },
        ],
        timestamp: 1699900000000,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/orderbook?exchange=mexc&symbol=BTC/USDT',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.exchange).toBe('mexc');
      expect(body.symbol).toBe('BTC/USDT');
      expect(body.bids).toHaveLength(2);
      expect(body.asks).toHaveLength(2);
      expect(body.bids[0].total).toBe(1.5); // Cumulative
      expect(body.bids[1].total).toBe(3.5); // Cumulative
      expect(body.spread).toBeDefined();
      expect(body.midPrice).toBeDefined();
    });

    it('should respect limit parameter', async () => {
      mockGetOrderBook.mockResolvedValue({
        symbol: 'BTC/USDT',
        bids: Array(20).fill({ price: 42000, amount: 1 }),
        asks: Array(20).fill({ price: 42001, amount: 1 }),
        timestamp: 1699900000000,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/orderbook?exchange=mexc&symbol=BTC/USDT&limit=5',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.bids).toHaveLength(5);
      expect(body.asks).toHaveLength(5);
    });

    it('should return 400 for missing parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/orderbook?exchange=mexc',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should calculate spread correctly', async () => {
      mockGetOrderBook.mockResolvedValue({
        symbol: 'BTC/USDT',
        bids: [{ price: 100, amount: 1 }],
        asks: [{ price: 101, amount: 1 }],
        timestamp: 1699900000000,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/orderbook?exchange=mexc&symbol=TEST/USDT',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.spread).toBe(1);
      expect(body.midPrice).toBe(100.5);
    });
  });
});
