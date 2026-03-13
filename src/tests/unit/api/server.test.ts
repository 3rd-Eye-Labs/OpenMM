import { createApiServer } from '../../../api/server';
import { FastifyInstance } from 'fastify';

describe('API Server', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApiServer({
      enableSwagger: false,
      enableCors: true,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Server Configuration', () => {
    it('should create server instance', () => {
      expect(app).toBeDefined();
    });

    it('should have registered routes', () => {
      const routes = app.printRoutes();
      expect(routes).toContain('health');
      expect(routes).toContain('icker'); // Part of 'ticker' in tree format
      expect(routes).toContain('balance');
    });
  });
});
