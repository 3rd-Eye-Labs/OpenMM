import { createApiServer } from '../../../api/server';
import { FastifyInstance } from 'fastify';
import { ExchangeFactory } from '../../../cli/exchange-factory';

jest.mock('../../../cli/exchange-factory', () => ({
  ExchangeFactory: {
    getExchange: jest.fn(),
  },
}));

describe('Orders Routes', () => {
  let app: FastifyInstance;
  const mockGetOpenOrders = jest.fn();
  const mockGetOrder = jest.fn();
  const mockCreateOrder = jest.fn();
  const mockCancelOrder = jest.fn();
  const mockCancelAllOrders = jest.fn();

  beforeAll(async () => {
    app = await createApiServer({ enableSwagger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (ExchangeFactory.getExchange as jest.Mock).mockResolvedValue({
      getOpenOrders: mockGetOpenOrders,
      getOrder: mockGetOrder,
      createOrder: mockCreateOrder,
      cancelOrder: mockCancelOrder,
      cancelAllOrders: mockCancelAllOrders,
    });
  });

  describe('GET /api/v1/orders', () => {
    it('should return list of open orders', async () => {
      mockGetOpenOrders.mockResolvedValue([
        { id: 'order-1', symbol: 'BTC/USDT', side: 'buy', type: 'limit', price: 42000, amount: 1.0, filled: 0, remaining: 1.0, status: 'open', timestamp: 1699900000000 },
        { id: 'order-2', symbol: 'BTC/USDT', side: 'sell', type: 'limit', price: 43000, amount: 0.5, filled: 0.2, remaining: 0.3, status: 'partial', timestamp: 1699900001000 },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/orders?exchange=mexc',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.exchange).toBe('mexc');
      expect(body.orders).toHaveLength(2);
      expect(body.count).toBe(2);
    });

    it('should filter by symbol', async () => {
      mockGetOpenOrders.mockResolvedValue([
        { id: 'order-1', symbol: 'ETH/USDT', side: 'buy', type: 'limit', price: 2500, amount: 1.0, filled: 0, remaining: 1.0, status: 'open', timestamp: 1699900000000 },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/orders?exchange=mexc&symbol=ETH/USDT',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.orders[0].symbol).toBe('ETH/USDT');
      expect(mockGetOpenOrders).toHaveBeenCalledWith('ETH/USDT');
    });
  });

  describe('GET /api/v1/orders/:id', () => {
    it('should return specific order by id', async () => {
      mockGetOrder.mockResolvedValue({
        id: 'order-123', symbol: 'BTC/USDT', side: 'buy', type: 'limit', price: 42000, amount: 1.0, filled: 0.5, remaining: 0.5, status: 'partial', timestamp: 1699900000000,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/orders/order-123?exchange=mexc&symbol=BTC/USDT',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.order.id).toBe('order-123');
      expect(body.order.filled).toBe(0.5);
    });

    it('should return 400 when symbol is missing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/orders/order-123?exchange=mexc',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/orders', () => {
    it('should create a limit order', async () => {
      mockCreateOrder.mockResolvedValue({
        id: 'new-order-1', symbol: 'BTC/USDT', side: 'buy', type: 'limit', price: 42000, amount: 1.0, filled: 0, remaining: 1.0, status: 'open', timestamp: 1699900000000,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/orders',
        payload: {
          exchange: 'mexc',
          symbol: 'BTC/USDT',
          side: 'buy',
          type: 'limit',
          amount: 1.0,
          price: 42000,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.order.id).toBe('new-order-1');
      expect(body.message).toContain('created');
    });

    it('should return 400 for limit order without price', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/orders',
        payload: {
          exchange: 'mexc',
          symbol: 'BTC/USDT',
          side: 'buy',
          type: 'limit',
          amount: 1.0,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('price is required');
    });

    it('should create a market order', async () => {
      mockCreateOrder.mockResolvedValue({
        id: 'market-order-1', symbol: 'BTC/USDT', side: 'sell', type: 'market', amount: 0.5, filled: 0.5, remaining: 0, status: 'filled', timestamp: 1699900000000,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/orders',
        payload: {
          exchange: 'mexc',
          symbol: 'BTC/USDT',
          side: 'sell',
          type: 'market',
          amount: 0.5,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.order.type).toBe('market');
    });
  });

  describe('DELETE /api/v1/orders/:id', () => {
    it('should cancel a specific order', async () => {
      mockCancelOrder.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/orders/order-123',
        payload: {
          exchange: 'mexc',
          symbol: 'BTC/USDT',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toContain('cancelled');
      expect(mockCancelOrder).toHaveBeenCalledWith('order-123', 'BTC/USDT');
    });
  });

  describe('DELETE /api/v1/orders', () => {
    it('should cancel all orders for a symbol', async () => {
      mockCancelAllOrders.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/orders',
        payload: {
          exchange: 'mexc',
          symbol: 'BTC/USDT',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toContain('All orders');
      expect(mockCancelAllOrders).toHaveBeenCalledWith('BTC/USDT');
    });
  });
});
