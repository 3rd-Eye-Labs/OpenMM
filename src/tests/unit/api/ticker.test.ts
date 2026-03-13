import { createApiServer } from '../../../api/server';
import { FastifyInstance } from 'fastify';
import { ExchangeFactory } from '../../../cli/exchange-factory';

// Mock the ExchangeFactory
jest.mock('../../../cli/exchange-factory', () => ({
  ExchangeFactory: {
    getExchange: jest.fn(),
  },
}));

describe('Ticker Routes', () => {
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

  describe('GET /api/v1/ticker', () => {
    it('should return ticker data for valid exchange and symbol', async () => {
      mockGetTicker.mockResolvedValue({
        symbol: 'BTC/USDT',
        last: 42000.5,
        bid: 42000.0,
        ask: 42001.0,
        baseVolume: 1234.56,
        quoteVolume: 51851352.8,
        timestamp: 1699900000000,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/ticker?exchange=mexc&symbol=BTC/USDT',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.exchange).toBe('mexc');
      expect(body.symbol).toBe('BTC/USDT');
      expect(body.last).toBe(42000.5);
      expect(body.bid).toBe(42000.0);
      expect(body.ask).toBe(42001.0);
      expect(body.spread).toBe(1.0);
      expect(body.spreadPercent).toBeDefined();
      expect(body.baseVolume).toBe(1234.56);
    });

    it('should return 400 for missing exchange parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/ticker?symbol=BTC/USDT',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing symbol parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/ticker?exchange=mexc',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid exchange', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/ticker?exchange=invalid&symbol=BTC/USDT',
      });

      expect(response.statusCode).toBe(400);
      // Fastify validates enum at schema level, returns Bad Request
    });

    it('should return 500 when exchange throws error', async () => {
      mockGetTicker.mockRejectedValue(new Error('Exchange unavailable'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/ticker?exchange=mexc&symbol=BTC/USDT',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Failed to fetch ticker');
    });
  });
});
