import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { createLogger } from '../utils';
import { registerRoutes } from './routes';
import { openApiConfig } from './openapi';

const logger = createLogger('api-server', './logs/api.log');

export interface ApiServerOptions {
  host?: string;
  port?: number;
  enableSwagger?: boolean;
  enableCors?: boolean;
}

export async function createApiServer(options: ApiServerOptions = {}): Promise<FastifyInstance> {
  const {
    host = '0.0.0.0',
    port = 3000,
    enableSwagger = true,
    enableCors = true,
  } = options;

  const app = Fastify({
    logger: false, // We use our own logger
  });

  // CORS
  if (enableCors) {
    await app.register(cors, {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    });
  }

  // OpenAPI / Swagger
  if (enableSwagger) {
    await app.register(swagger, openApiConfig);
    await app.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
      },
    });
  }

  // Register all routes
  await registerRoutes(app);

  // Store options for later use
  app.decorate('apiOptions', { host, port });

  return app;
}

export async function startApiServer(options: ApiServerOptions = {}): Promise<FastifyInstance> {
  const { host = '0.0.0.0', port = 3000 } = options;
  
  const app = await createApiServer(options);

  try {
    await app.listen({ host, port });
    logger.info(`OpenMM API server running at http://${host}:${port}`);
    logger.info(`OpenAPI docs available at http://${host}:${port}/docs`);
    return app;
  } catch (err) {
    logger.error('Failed to start API server: ' + (err instanceof Error ? err.message : String(err)));
    throw err;
  }
}

export { FastifyInstance };
