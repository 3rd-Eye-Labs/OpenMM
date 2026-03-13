import { createApiServer } from '../../../api/server';
import { FastifyInstance } from 'fastify';

describe('Health Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApiServer({ enableSwagger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/health', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
      expect(typeof body.uptime).toBe('number');
    });
  });

  describe('GET /api/v1/health/detailed', () => {
    it('should return detailed health with exchange status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health/detailed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBeDefined();
      expect(body.exchanges).toBeDefined();
      expect(body.exchanges.mexc).toBeDefined();
      expect(body.exchanges.gateio).toBeDefined();
      expect(body.exchanges.bitget).toBeDefined();
      expect(body.exchanges.kraken).toBeDefined();
    });
  });

  describe('GET /api/v1/ready', () => {
    it('should return readiness status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/ready',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ready).toBe(true);
    });
  });
});
