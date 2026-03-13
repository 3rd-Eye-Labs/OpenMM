import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ExchangeFactory, SupportedExchange } from '../../cli/exchange-factory';
import { Trade } from '../../types';

interface TradesQuery {
  exchange: SupportedExchange;
  symbol: string;
  limit?: number;
}

interface TradeResponse {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  amount: number;
  cost: number;
  timestamp: number;
}

interface TradesResponse {
  exchange: string;
  symbol: string;
  trades: TradeResponse[];
  summary: {
    totalTrades: number;
    buyCount: number;
    sellCount: number;
    buyVolume: number;
    sellVolume: number;
    avgPrice: number;
  };
}

export async function tradesRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: TradesQuery }>('/trades', {
    schema: {
      tags: ['Market Data'],
      summary: 'Get recent trades',
      description: 'Returns recent trades for a trading pair with buy/sell breakdown.',
      querystring: {
        type: 'object',
        required: ['exchange', 'symbol'],
        properties: {
          exchange: {
            type: 'string',
            enum: ['mexc', 'gateio', 'bitget', 'kraken'],
            description: 'Exchange to query',
          },
          symbol: {
            type: 'string',
            description: 'Trading pair (e.g., BTC/USDT)',
            example: 'BTC/USDT',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 500,
            default: 50,
            description: 'Number of trades to return (max 500)',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            exchange: { type: 'string' },
            symbol: { type: 'string' },
            trades: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  symbol: { type: 'string' },
                  side: { type: 'string', enum: ['buy', 'sell'] },
                  price: { type: 'number' },
                  amount: { type: 'number' },
                  cost: { type: 'number', description: 'price * amount' },
                  timestamp: { type: 'number' },
                },
              },
            },
            summary: {
              type: 'object',
              properties: {
                totalTrades: { type: 'number' },
                buyCount: { type: 'number' },
                sellCount: { type: 'number' },
                buyVolume: { type: 'number' },
                sellVolume: { type: 'number' },
                avgPrice: { type: 'number' },
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
  }, async (request: FastifyRequest<{ Querystring: TradesQuery }>, reply: FastifyReply): Promise<TradesResponse> => {
    const { exchange, symbol, limit = 50 } = request.query;

    if (!exchange || !symbol) {
      return reply.status(400).send({ error: 'Missing required parameters: exchange and symbol' });
    }

    const validExchanges = ['mexc', 'gateio', 'bitget', 'kraken'];
    if (!validExchanges.includes(exchange)) {
      return reply.status(400).send({ error: `Invalid exchange. Must be one of: ${validExchanges.join(', ')}` });
    }

    try {
      const connector = await ExchangeFactory.getExchange(exchange);
      const rawTrades: Trade[] = await connector.getRecentTrades(symbol);

      // Limit and transform trades
      const trades: TradeResponse[] = rawTrades.slice(0, limit).map((trade) => ({
        id: trade.id,
        symbol: trade.symbol,
        side: trade.side,
        price: trade.price,
        amount: trade.amount,
        cost: trade.price * trade.amount,
        timestamp: trade.timestamp,
      }));

      // Calculate summary
      const buyTrades = trades.filter(t => t.side === 'buy');
      const sellTrades = trades.filter(t => t.side === 'sell');
      const buyVolume = buyTrades.reduce((sum, t) => sum + t.amount, 0);
      const sellVolume = sellTrades.reduce((sum, t) => sum + t.amount, 0);
      const totalVolume = buyVolume + sellVolume;
      const avgPrice = totalVolume > 0 
        ? trades.reduce((sum, t) => sum + t.price * t.amount, 0) / totalVolume 
        : 0;

      return {
        exchange,
        symbol,
        trades,
        summary: {
          totalTrades: trades.length,
          buyCount: buyTrades.length,
          sellCount: sellTrades.length,
          buyVolume,
          sellVolume,
          avgPrice: Math.round(avgPrice * 100000000) / 100000000, // 8 decimal places
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.status(500).send({ error: `Failed to fetch trades: ${message}` });
    }
  });
}
