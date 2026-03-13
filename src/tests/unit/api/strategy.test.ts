import { createApiServer } from '../../../api/server';
import { FastifyInstance } from 'fastify';
import { ExchangeFactory } from '../../../cli/exchange-factory';
import { GridStrategy } from '../../../strategies/grid/grid-strategy';

jest.mock('../../../cli/exchange-factory', () => ({
  ExchangeFactory: {
    getExchange: jest.fn(),
  },
}));

jest.mock('../../../strategies/grid/grid-strategy');

describe('Strategy Routes', () => {
  let app: FastifyInstance;
  const mockGridStrategy = {
    setExchangeConnector: jest.fn(),
    initialize: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    currentStatus: 'running',
  };

  beforeAll(async () => {
    (GridStrategy as jest.Mock).mockImplementation(() => mockGridStrategy);
    app = await createApiServer({ enableSwagger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGridStrategy.start.mockResolvedValue(undefined);
    mockGridStrategy.stop.mockResolvedValue(undefined);
    mockGridStrategy.initialize.mockResolvedValue(undefined);
    (ExchangeFactory.getExchange as jest.Mock).mockResolvedValue({});
  });

  describe('POST /api/v1/strategy/grid', () => {
    it('should start a grid strategy', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/strategy/grid',
        payload: {
          exchange: 'mexc',
          symbol: 'BTC/USDT',
          lowerPrice: 40000,
          upperPrice: 44000,
          gridLevels: 10,
          orderSize: 100,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toContain('grid-mexc-BTC-USDT');
      expect(body.status).toBe('running');
      expect(body.config.exchange).toBe('mexc');
      expect(body.config.symbol).toBe('BTC/USDT');
      expect(body.config.gridLevels).toBe(10);
    });

    it('should return 400 if lowerPrice >= upperPrice', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/strategy/grid',
        payload: {
          exchange: 'mexc',
          symbol: 'BTC/USDT',
          lowerPrice: 44000,
          upperPrice: 40000,
          gridLevels: 10,
          orderSize: 100,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('lowerPrice must be less than upperPrice');
    });

    it('should auto-calculate gridSpacing if not provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/strategy/grid',
        payload: {
          exchange: 'mexc',
          symbol: 'BTC/USDT',
          lowerPrice: 40000,
          upperPrice: 44000,
          gridLevels: 10,
          orderSize: 100,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.config.gridSpacing).toBe(400); // (44000-40000)/10
    });

    it('should use custom gridSpacing if provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/strategy/grid',
        payload: {
          exchange: 'mexc',
          symbol: 'BTC/USDT',
          lowerPrice: 40000,
          upperPrice: 44000,
          gridLevels: 10,
          orderSize: 100,
          gridSpacing: 500,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.config.gridSpacing).toBe(500);
    });
  });

  describe('DELETE /api/v1/strategy/grid', () => {
    it('should return 404 for non-existent strategy', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/strategy/grid',
        payload: {
          id: 'non-existent-id',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Strategy not found');
    });
  });

  describe('GET /api/v1/strategy/grid/status', () => {
    it('should return empty list when no strategies running', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/strategy/grid/status',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.strategies).toBeDefined();
      expect(body.count).toBeDefined();
    });

    it('should return 404 for non-existent strategy ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/strategy/grid/status?id=non-existent',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/strategy/grid/list', () => {
    it('should return list of strategies', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/strategy/grid/list',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.strategies).toBeDefined();
      expect(Array.isArray(body.strategies)).toBe(true);
      expect(body.count).toBeDefined();
    });
  });
});
