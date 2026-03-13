import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ExchangeFactory, SupportedExchange } from '../../cli/exchange-factory';
import { Balance } from '../../types';

interface BalanceQuery {
  exchange: SupportedExchange;
  asset?: string;
}

interface BalanceEntry {
  asset: string;
  free: number;
  used: number;
  total: number;
  available: number;
}

interface BalanceResponse {
  exchange: string;
  balances: BalanceEntry[];
  timestamp: number;
}

export async function balanceRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: BalanceQuery }>('/balance', {
    schema: {
      tags: ['Account'],
      summary: 'Get account balances',
      description: 'Returns account balances for all assets or a specific asset on an exchange.',
      querystring: {
        type: 'object',
        required: ['exchange'],
        properties: {
          exchange: {
            type: 'string',
            enum: ['mexc', 'gateio', 'bitget', 'kraken'],
            description: 'Exchange to query',
          },
          asset: {
            type: 'string',
            description: 'Filter by specific asset (e.g., BTC, USDT)',
            example: 'BTC',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            exchange: { type: 'string' },
            balances: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  asset: { type: 'string' },
                  free: { type: 'number', description: 'Free balance' },
                  used: { type: 'number', description: 'Used in orders' },
                  total: { type: 'number', description: 'Total balance' },
                  available: { type: 'number', description: 'Available balance' },
                },
              },
            },
            timestamp: { type: 'number' },
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
  }, async (request: FastifyRequest<{ Querystring: BalanceQuery }>, reply: FastifyReply): Promise<BalanceResponse> => {
    const { exchange, asset } = request.query;

    if (!exchange) {
      return reply.status(400).send({ error: 'Missing required parameter: exchange' });
    }

    const validExchanges = ['mexc', 'gateio', 'bitget', 'kraken'];
    if (!validExchanges.includes(exchange)) {
      return reply.status(400).send({ error: `Invalid exchange. Must be one of: ${validExchanges.join(', ')}` });
    }

    try {
      const connector = await ExchangeFactory.getExchange(exchange);
      const rawBalances: Record<string, Balance> = await connector.getBalance();

      // Transform and optionally filter balances
      let balances: BalanceEntry[] = Object.entries(rawBalances).map(([assetName, balance]) => ({
        asset: assetName,
        free: balance.free,
        used: balance.used,
        total: balance.total,
        available: balance.available,
      }));

      // Filter by asset if specified
      if (asset) {
        const assetUpper = asset.toUpperCase();
        balances = balances.filter(b => b.asset.toUpperCase() === assetUpper);
      }

      // Filter out zero balances unless specific asset requested
      if (!asset) {
        balances = balances.filter(b => b.total > 0);
      }

      // Sort by total balance (descending)
      balances.sort((a, b) => b.total - a.total);

      return {
        exchange,
        balances,
        timestamp: Date.now(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.status(500).send({ error: `Failed to fetch balance: ${message}` });
    }
  });
}
