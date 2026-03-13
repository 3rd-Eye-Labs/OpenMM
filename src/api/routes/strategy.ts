import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GridStrategy } from '../../strategies/grid/grid-strategy';
import { ExchangeFactory, SupportedExchange } from '../../cli/exchange-factory';
import { GridStrategyConfig, StrategyStatus } from '../../types';
import { createLogger } from '../../utils';

const logger = createLogger('strategy-api');

// In-memory strategy store (for demo - production would use persistent storage)
const activeStrategies: Map<string, {
  strategy: GridStrategy;
  config: GridStrategyConfig;
  startedAt: number;
  filledOrders: number;
  profit: number;
}> = new Map();

interface StartGridBody {
  exchange: SupportedExchange;
  symbol: string;
  lowerPrice: number;
  upperPrice: number;
  gridLevels: number;
  orderSize: number;
  gridSpacing?: number;
}

interface StopGridBody {
  id: string;
  cancelOrders?: boolean;
}

interface GridStatusQuery {
  id?: string;
}

interface GridStatusResponse {
  id: string;
  status: StrategyStatus;
  exchange: string;
  symbol: string;
  lowerPrice: number;
  upperPrice: number;
  gridLevels: number;
  orderSize: number;
  openOrders: number;
  filledOrders: number;
  profit: number;
  startedAt: number;
  runningTime: number;
}

export async function strategyRoutes(app: FastifyInstance): Promise<void> {
  // POST /strategy/grid - Start a grid strategy (QBT-362)
  app.post<{ Body: StartGridBody }>('/strategy/grid', {
    schema: {
      tags: ['Strategy'],
      summary: 'Start a grid trading strategy',
      description: 'Creates and starts a new grid trading strategy with the specified parameters.',
      body: {
        type: 'object',
        required: ['exchange', 'symbol', 'lowerPrice', 'upperPrice', 'gridLevels', 'orderSize'],
        properties: {
          exchange: { type: 'string', enum: ['mexc', 'gateio', 'bitget', 'kraken'] },
          symbol: { type: 'string', description: 'Trading pair', example: 'BTC/USDT' },
          lowerPrice: { type: 'number', minimum: 0, description: 'Lower price bound' },
          upperPrice: { type: 'number', minimum: 0, description: 'Upper price bound' },
          gridLevels: { type: 'integer', minimum: 2, maximum: 100, description: 'Number of grid levels' },
          orderSize: { type: 'number', minimum: 0, description: 'Size per order in quote currency' },
          gridSpacing: { type: 'number', minimum: 0, description: 'Custom spacing (default: auto-calculated)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: { type: 'string' },
            message: { type: 'string' },
            config: {
              type: 'object',
              properties: {
                exchange: { type: 'string' },
                symbol: { type: 'string' },
                lowerPrice: { type: 'number' },
                upperPrice: { type: 'number' },
                gridLevels: { type: 'number' },
                orderSize: { type: 'number' },
                gridSpacing: { type: 'number' },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        500: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: StartGridBody }>, reply: FastifyReply) => {
    const { exchange, symbol, lowerPrice, upperPrice, gridLevels, orderSize, gridSpacing } = request.body;

    // Validate price range
    if (lowerPrice >= upperPrice) {
      return reply.status(400).send({ error: 'lowerPrice must be less than upperPrice' });
    }

    // Calculate grid spacing if not provided
    const calculatedSpacing = gridSpacing ?? (upperPrice - lowerPrice) / gridLevels;

    // Generate unique strategy ID
    const strategyId = `grid-${exchange}-${symbol.replace('/', '-')}-${Date.now()}`;

    try {
      // Get exchange connector
      const connector = await ExchangeFactory.getExchange(exchange);

      // Create strategy config
      const config: GridStrategyConfig = {
        id: strategyId,
        type: 'grid',
        symbol,
        exchange,
        accountId: 'default',
        enabled: true,
        gridConfig: {
          symbol,
          gridLevels,
          gridSpacing: calculatedSpacing,
          orderSize,
          minConfidence: 0.6,
          priceDeviationThreshold: 0.015,
          adjustmentDebounce: 2000,
        },
        parameters: {
          gridLevels,
          gridSpacing: calculatedSpacing,
          orderSize,
          upperPrice,
          lowerPrice,
        },
      };

      // Create and initialize strategy
      const strategy = new GridStrategy(strategyId);
      strategy.setExchangeConnector(connector);
      await strategy.initialize(config);

      // Store strategy reference
      activeStrategies.set(strategyId, {
        strategy,
        config,
        startedAt: Date.now(),
        filledOrders: 0,
        profit: 0,
      });

      // Start strategy (async - don't await)
      strategy.start().catch((err) => {
        logger.error(`Strategy ${strategyId} failed: ${err instanceof Error ? err.message : String(err)}`);
        const stored = activeStrategies.get(strategyId);
        if (stored) {
          stored.strategy.stop();
        }
      });

      logger.info(`Started grid strategy: ${strategyId}`);

      return {
        id: strategyId,
        status: 'running',
        message: 'Grid strategy started successfully',
        config: {
          exchange,
          symbol,
          lowerPrice,
          upperPrice,
          gridLevels,
          orderSize,
          gridSpacing: calculatedSpacing,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to start grid strategy: ${message}`);
      return reply.status(500).send({ error: `Failed to start strategy: ${message}` });
    }
  });

  // DELETE /strategy/grid - Stop a grid strategy (QBT-363)
  app.delete<{ Body: StopGridBody }>('/strategy/grid', {
    schema: {
      tags: ['Strategy'],
      summary: 'Stop a grid trading strategy',
      description: 'Stops a running grid strategy and optionally cancels all open orders.',
      body: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Strategy ID to stop' },
          cancelOrders: { type: 'boolean', default: true, description: 'Cancel all open orders' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            id: { type: 'string' },
            message: { type: 'string' },
            summary: {
              type: 'object',
              properties: {
                runningTime: { type: 'number', description: 'Running time in ms' },
                filledOrders: { type: 'number' },
                profit: { type: 'number' },
              },
            },
          },
        },
        404: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        500: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: StopGridBody }>, reply: FastifyReply) => {
    const { id, cancelOrders = true } = request.body;

    const stored = activeStrategies.get(id);
    if (!stored) {
      return reply.status(404).send({ error: `Strategy not found: ${id}` });
    }

    try {
      // Stop the strategy
      await stored.strategy.stop();

      // Calculate summary
      const runningTime = Date.now() - stored.startedAt;
      const summary = {
        runningTime,
        filledOrders: stored.filledOrders,
        profit: stored.profit,
      };

      // Remove from active strategies
      activeStrategies.delete(id);

      logger.info(`Stopped grid strategy: ${id}`);

      return {
        success: true,
        id,
        message: `Strategy stopped${cancelOrders ? ' and orders cancelled' : ''}`,
        summary,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to stop grid strategy: ${message}`);
      return reply.status(500).send({ error: `Failed to stop strategy: ${message}` });
    }
  });

  // GET /strategy/grid/status - Get grid strategy status (QBT-364)
  app.get<{ Querystring: GridStatusQuery }>('/strategy/grid/status', {
    schema: {
      tags: ['Strategy'],
      summary: 'Get grid strategy status',
      description: 'Returns the status of a specific strategy or all active strategies.',
      querystring: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Strategy ID (optional, returns all if omitted)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            strategies: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  status: { type: 'string' },
                  exchange: { type: 'string' },
                  symbol: { type: 'string' },
                  lowerPrice: { type: 'number' },
                  upperPrice: { type: 'number' },
                  gridLevels: { type: 'number' },
                  orderSize: { type: 'number' },
                  openOrders: { type: 'number' },
                  filledOrders: { type: 'number' },
                  profit: { type: 'number' },
                  startedAt: { type: 'number' },
                  runningTime: { type: 'number' },
                },
              },
            },
            count: { type: 'number' },
          },
        },
        404: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: GridStatusQuery }>, reply: FastifyReply) => {
    const { id } = request.query;

    // If specific ID requested
    if (id) {
      const stored = activeStrategies.get(id);
      if (!stored) {
        return reply.status(404).send({ error: `Strategy not found: ${id}` });
      }

      const status = buildStrategyStatus(id, stored);
      return {
        strategies: [status],
        count: 1,
      };
    }

    // Return all active strategies
    const strategies: GridStatusResponse[] = [];
    for (const [strategyId, stored] of activeStrategies.entries()) {
      strategies.push(buildStrategyStatus(strategyId, stored));
    }

    return {
      strategies,
      count: strategies.length,
    };
  });

  // GET /strategy/grid/list - List all active grid strategies
  app.get('/strategy/grid/list', {
    schema: {
      tags: ['Strategy'],
      summary: 'List all active grid strategies',
      description: 'Returns a list of all currently running grid strategies.',
      response: {
        200: {
          type: 'object',
          properties: {
            strategies: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  exchange: { type: 'string' },
                  symbol: { type: 'string' },
                  status: { type: 'string' },
                  startedAt: { type: 'number' },
                },
              },
            },
            count: { type: 'number' },
          },
        },
      },
    },
  }, async () => {
    const strategies = Array.from(activeStrategies.entries()).map(([id, stored]) => ({
      id,
      exchange: stored.config.exchange,
      symbol: stored.config.symbol,
      status: stored.strategy.currentStatus,
      startedAt: stored.startedAt,
    }));

    return {
      strategies,
      count: strategies.length,
    };
  });
}

// Helper function to build status response
function buildStrategyStatus(
  id: string,
  stored: {
    strategy: GridStrategy;
    config: GridStrategyConfig;
    startedAt: number;
    filledOrders: number;
    profit: number;
  }
): GridStatusResponse {
  const now = Date.now();
  return {
    id,
    status: stored.strategy.currentStatus,
    exchange: stored.config.exchange,
    symbol: stored.config.symbol,
    lowerPrice: stored.config.parameters.lowerPrice,
    upperPrice: stored.config.parameters.upperPrice,
    gridLevels: stored.config.parameters.gridLevels,
    orderSize: stored.config.parameters.orderSize,
    openOrders: 0, // TODO: Implement getOpenOrders in GridStrategy
    filledOrders: stored.filledOrders,
    profit: stored.profit,
    startedAt: stored.startedAt,
    runningTime: now - stored.startedAt,
  };
}
