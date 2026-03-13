import { FastifyInstance } from 'fastify';
import { healthRoutes } from './health';
import { tickerRoutes } from './ticker';
import { orderbookRoutes } from './orderbook';
import { tradesRoutes } from './trades';
import { balanceRoutes } from './balance';
import { ordersRoutes } from './orders';
import { cardanoRoutes } from './cardano';
import { priceRoutes } from './price';
import { strategyRoutes } from './strategy';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Health check routes
  await app.register(healthRoutes, { prefix: '/api/v1' });

  // Market data routes
  await app.register(tickerRoutes, { prefix: '/api/v1' });
  await app.register(orderbookRoutes, { prefix: '/api/v1' });
  await app.register(tradesRoutes, { prefix: '/api/v1' });

  // Account routes
  await app.register(balanceRoutes, { prefix: '/api/v1' });

  // Order management routes
  await app.register(ordersRoutes, { prefix: '/api/v1' });

  // Cardano DEX routes
  await app.register(cardanoRoutes, { prefix: '/api/v1' });

  // Price comparison routes
  await app.register(priceRoutes, { prefix: '/api/v1' });

  // Strategy routes
  await app.register(strategyRoutes, { prefix: '/api/v1' });

  // Future route registrations:
  // await app.register(balanceRoutes, { prefix: '/api/v1' });
  // await app.register(orderbookRoutes, { prefix: '/api/v1' });
  // await app.register(tradesRoutes, { prefix: '/api/v1' });
  // await app.register(ordersRoutes, { prefix: '/api/v1' });
  // await app.register(strategyRoutes, { prefix: '/api/v1' });
  // await app.register(cardanoRoutes, { prefix: '/api/v1' });
  // await app.register(priceRoutes, { prefix: '/api/v1' });
}
