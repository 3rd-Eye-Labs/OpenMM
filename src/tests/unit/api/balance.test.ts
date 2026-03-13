import { createApiServer } from '../../../api/server';
import { FastifyInstance } from 'fastify';
import { ExchangeFactory } from '../../../cli/exchange-factory';

jest.mock('../../../cli/exchange-factory', () => ({
  ExchangeFactory: {
    getExchange: jest.fn(),
  },
}));

describe('Balance Routes', () => {
  let app: FastifyInstance;
  const mockGetBalance = jest.fn();

  beforeAll(async () => {
    app = await createApiServer({ enableSwagger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (ExchangeFactory.getExchange as jest.Mock).mockResolvedValue({
      getBalance: mockGetBalance,
    });
  });

  describe('GET /api/v1/balance', () => {
    it('should return all non-zero balances', async () => {
      mockGetBalance.mockResolvedValue({
        BTC: { asset: 'BTC', free: 1.5, used: 0.5, total: 2.0, available: 1.5 },
        ETH: { asset: 'ETH', free: 10, used: 2, total: 12, available: 10 },
        USDT: { asset: 'USDT', free: 0, used: 0, total: 0, available: 0 },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/balance?exchange=mexc',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.exchange).toBe('mexc');
      expect(body.balances).toHaveLength(2); // Zero balances filtered
      expect(body.balances[0].asset).toBe('ETH'); // Sorted by total desc
      expect(body.balances[1].asset).toBe('BTC');
    });

    it('should filter by specific asset', async () => {
      mockGetBalance.mockResolvedValue({
        BTC: { asset: 'BTC', free: 1.5, used: 0.5, total: 2.0, available: 1.5 },
        ETH: { asset: 'ETH', free: 10, used: 2, total: 12, available: 10 },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/balance?exchange=mexc&asset=BTC',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.balances).toHaveLength(1);
      expect(body.balances[0].asset).toBe('BTC');
      expect(body.balances[0].free).toBe(1.5);
      expect(body.balances[0].used).toBe(0.5);
      expect(body.balances[0].total).toBe(2.0);
    });

    it('should return empty array when asset not found', async () => {
      mockGetBalance.mockResolvedValue({
        BTC: { asset: 'BTC', free: 1.5, used: 0.5, total: 2.0, available: 1.5 },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/balance?exchange=mexc&asset=DOGE',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.balances).toHaveLength(0);
    });

    it('should return 400 for missing exchange', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/balance',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle case-insensitive asset filter', async () => {
      mockGetBalance.mockResolvedValue({
        BTC: { asset: 'BTC', free: 1.5, used: 0.5, total: 2.0, available: 1.5 },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/balance?exchange=mexc&asset=btc',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.balances).toHaveLength(1);
      expect(body.balances[0].asset).toBe('BTC');
    });
  });
});
