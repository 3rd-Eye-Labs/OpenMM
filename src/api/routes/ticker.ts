import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ExchangeFactory, SupportedExchange } from '../../cli/exchange-factory';
import { Ticker } from '../../types';

interface TickerQuery {
  exchange: SupportedExchange;
  symbol: string;
}

interface TickerResponse {
  exchange: string;
  symbol: string;
  last: number;
  bid: number;
  ask: number;
  spread: number;
  spreadPercent: number;
  baseVolume: number;
  quoteVolume?: number;
  timestamp: number;
}

export async function tickerRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: TickerQuery }>('/ticker', {
    schema: {
      tags: ['Market Data'],
      summary: 'Get ticker data for a trading pair',
      description: 'Returns current price, bid/ask, spread, and 24h statistics for a trading pair on a specific exchange.',
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
            description: 'Trading pair (e.g., BTC/USDT, ETH/USDT)',
            example: 'BTC/USDT',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            exchange: { type: 'string' },
            symbol: { type: 'string' },
            last: { type: 'number', description: 'Last traded price' },
            bid: { type: 'number', description: 'Best bid price' },
            ask: { type: 'number', description: 'Best ask price' },
            spread: { type: 'number', description: 'Absolute spread (ask - bid)' },
            spreadPercent: { type: 'number', description: 'Spread as percentage of mid price' },
            baseVolume: { type: 'number', description: '24h volume in base currency' },
            quoteVolume: { type: 'number', description: '24h volume in quote currency' },
            timestamp: { type: 'number', description: 'Data timestamp (ms)' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: TickerQuery }>, reply: FastifyReply): Promise<TickerResponse> => {
    const { exchange, symbol } = request.query;

    if (!exchange || !symbol) {
      return reply.status(400).send({ error: 'Missing required parameters: exchange and symbol' });
    }

    const validExchanges = ['mexc', 'gateio', 'bitget', 'kraken'];
    if (!validExchanges.includes(exchange)) {
      return reply.status(400).send({ error: `Invalid exchange. Must be one of: ${validExchanges.join(', ')}` });
    }

    try {
      const connector = await ExchangeFactory.getExchange(exchange);
      const ticker: Ticker = await connector.getTicker(symbol);

      const spread = ticker.ask - ticker.bid;
      const midPrice = (ticker.ask + ticker.bid) / 2;
      const spreadPercent = midPrice > 0 ? (spread / midPrice) * 100 : 0;

      return {
        exchange,
        symbol: ticker.symbol,
        last: ticker.last,
        bid: ticker.bid,
        ask: ticker.ask,
        spread,
        spreadPercent: Math.round(spreadPercent * 10000) / 10000, // 4 decimal places
        baseVolume: ticker.baseVolume,
        quoteVolume: ticker.quoteVolume,
        timestamp: ticker.timestamp || Date.now(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.status(500).send({ error: `Failed to fetch ticker: ${message}` });
    }
  });
}
