import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ExchangeFactory, SupportedExchange } from '../../cli/exchange-factory';
import { OrderBook, OrderBookEntry as BaseOrderBookEntry } from '../../types';

interface OrderBookQuery {
  exchange: SupportedExchange;
  symbol: string;
  limit?: number;
}

interface OrderBookEntryWithTotal {
  price: number;
  amount: number;
  total: number; // cumulative amount
}

interface OrderBookResponse {
  exchange: string;
  symbol: string;
  bids: OrderBookEntryWithTotal[];
  asks: OrderBookEntryWithTotal[];
  spread: number;
  spreadPercent: number;
  midPrice: number;
  timestamp: number;
}

export async function orderbookRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: OrderBookQuery }>('/orderbook', {
    schema: {
      tags: ['Market Data'],
      summary: 'Get order book depth',
      description: 'Returns the order book (bids and asks) for a trading pair with cumulative totals.',
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
            maximum: 100,
            default: 10,
            description: 'Number of price levels to return (max 100)',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            exchange: { type: 'string' },
            symbol: { type: 'string' },
            bids: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  price: { type: 'number' },
                  amount: { type: 'number' },
                  total: { type: 'number', description: 'Cumulative amount' },
                },
              },
            },
            asks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  price: { type: 'number' },
                  amount: { type: 'number' },
                  total: { type: 'number', description: 'Cumulative amount' },
                },
              },
            },
            spread: { type: 'number', description: 'Best ask - best bid' },
            spreadPercent: { type: 'number', description: 'Spread as percentage of mid price' },
            midPrice: { type: 'number', description: '(Best bid + best ask) / 2' },
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
  }, async (request: FastifyRequest<{ Querystring: OrderBookQuery }>, reply: FastifyReply): Promise<OrderBookResponse> => {
    const { exchange, symbol, limit = 10 } = request.query;

    if (!exchange || !symbol) {
      return reply.status(400).send({ error: 'Missing required parameters: exchange and symbol' });
    }

    const validExchanges = ['mexc', 'gateio', 'bitget', 'kraken'];
    if (!validExchanges.includes(exchange)) {
      return reply.status(400).send({ error: `Invalid exchange. Must be one of: ${validExchanges.join(', ')}` });
    }

    try {
      const connector = await ExchangeFactory.getExchange(exchange);
      const orderbook: OrderBook = await connector.getOrderBook(symbol);

      // Add cumulative totals and limit results
      const processEntries = (entries: BaseOrderBookEntry[]): OrderBookEntryWithTotal[] => {
        let cumulative = 0;
        return entries.slice(0, limit).map((entry) => {
          cumulative += entry.amount;
          return { price: entry.price, amount: entry.amount, total: cumulative };
        });
      };

      const bids = processEntries(orderbook.bids);
      const asks = processEntries(orderbook.asks);

      // Calculate spread
      const bestBid = bids.length > 0 ? bids[0].price : 0;
      const bestAsk = asks.length > 0 ? asks[0].price : 0;
      const spread = bestAsk - bestBid;
      const midPrice = (bestBid + bestAsk) / 2;
      const spreadPercent = midPrice > 0 ? (spread / midPrice) * 100 : 0;

      return {
        exchange,
        symbol: orderbook.symbol,
        bids,
        asks,
        spread,
        spreadPercent: Math.round(spreadPercent * 10000) / 10000,
        midPrice,
        timestamp: orderbook.timestamp || Date.now(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.status(500).send({ error: `Failed to fetch orderbook: ${message}` });
    }
  });
}
