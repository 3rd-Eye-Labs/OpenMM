import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: number;
  version: string;
  uptime: number;
  exchanges?: {
    [key: string]: {
      configured: boolean;
      connected?: boolean;
    };
  };
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  // Basic health check
  app.get('/health', {
    schema: {
      tags: ['Health'],
      summary: 'Health check',
      description: 'Returns the health status of the API server',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok', 'degraded', 'error'] },
            timestamp: { type: 'number' },
            version: { type: 'string' },
            uptime: { type: 'number', description: 'Uptime in seconds' },
          },
        },
      },
    },
  }, async (_request: FastifyRequest, _reply: FastifyReply): Promise<HealthResponse> => {
    return {
      status: 'ok',
      timestamp: Date.now(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
    };
  });

  // Detailed health check with exchange status
  app.get('/health/detailed', {
    schema: {
      tags: ['Health'],
      summary: 'Detailed health check',
      description: 'Returns detailed health status including exchange connectivity',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok', 'degraded', 'error'] },
            timestamp: { type: 'number' },
            version: { type: 'string' },
            uptime: { type: 'number' },
            exchanges: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  configured: { type: 'boolean' },
                  connected: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
  }, async (_request: FastifyRequest, _reply: FastifyReply): Promise<HealthResponse> => {
    const exchanges = {
      mexc: {
        configured: !!(process.env.MEXC_API_KEY && process.env.MEXC_SECRET_KEY),
      },
      gateio: {
        configured: !!(process.env.GATEIO_API_KEY && process.env.GATEIO_SECRET_KEY),
      },
      bitget: {
        configured: !!(process.env.BITGET_API_KEY && process.env.BITGET_SECRET_KEY),
      },
      kraken: {
        configured: !!(process.env.KRAKEN_API_KEY && process.env.KRAKEN_SECRET_KEY),
      },
    };

    const configuredCount = Object.values(exchanges).filter(e => e.configured).length;
    const status = configuredCount > 0 ? 'ok' : 'degraded';

    return {
      status,
      timestamp: Date.now(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      exchanges,
    };
  });

  // Ready check for load balancers
  app.get('/ready', {
    schema: {
      tags: ['Health'],
      summary: 'Readiness check',
      description: 'Returns whether the server is ready to accept traffic',
      response: {
        200: {
          type: 'object',
          properties: {
            ready: { type: 'boolean' },
          },
        },
        503: {
          type: 'object',
          properties: {
            ready: { type: 'boolean' },
            reason: { type: 'string' },
          },
        },
      },
    },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    // Add any readiness checks here (database, cache, etc.)
    const ready = true;
    
    if (!ready) {
      return reply.status(503).send({ ready: false, reason: 'Service not ready' });
    }
    
    return { ready: true };
  });
}
