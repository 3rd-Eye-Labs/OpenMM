import { FastifyInstance } from 'fastify';
import { healthRoutes } from './health';
import { tickerRoutes } from './ticker';
import { orderbookRoutes } from './orderbook';
import { tradesRoutes } from './trades';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Health check routes
  await app.register(healthRoutes, { prefix: '/api/v1' });

  // Market data routes
  await app.register(tickerRoutes, { prefix: '/api/v1' });
  await app.register(orderbookRoutes, { prefix: '/api/v1' });
  await app.register(tradesRoutes, { prefix: '/api/v1' });

  // Future route registrations:
  // await app.register(balanceRoutes, { prefix: '/api/v1' });
  // await app.register(orderbookRoutes, { prefix: '/api/v1' });
  // await app.register(tradesRoutes, { prefix: '/api/v1' });
  // await app.register(ordersRoutes, { prefix: '/api/v1' });
  // await app.register(strategyRoutes, { prefix: '/api/v1' });
  // await app.register(cardanoRoutes, { prefix: '/api/v1' });
  // await app.register(priceRoutes, { prefix: '/api/v1' });
}
