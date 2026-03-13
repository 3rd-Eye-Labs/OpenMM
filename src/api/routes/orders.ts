import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ExchangeFactory, SupportedExchange } from '../../cli/exchange-factory';
import { Order, OrderType, OrderSide } from '../../types';

// Query/Params interfaces
interface OrdersQuery {
  exchange: SupportedExchange;
  symbol?: string;
}

interface OrderParams {
  id: string;
}

interface CreateOrderBody {
  exchange: SupportedExchange;
  symbol: string;
  side: OrderSide;
  type?: OrderType;
  amount: number;
  price?: number;
}

interface CancelOrderBody {
  exchange: SupportedExchange;
  symbol: string;
}

// Response interfaces
interface OrderResponse {
  id: string;
  symbol: string;
  side: string;
  type: string;
  price: number;
  amount: number;
  filled: number;
  remaining: number;
  status: string;
  timestamp: number;
}

export async function ordersRoutes(app: FastifyInstance): Promise<void> {
  // GET /orders - List open orders (QBT-357)
  app.get<{ Querystring: OrdersQuery }>('/orders', {
    schema: {
      tags: ['Orders'],
      summary: 'List open orders',
      description: 'Returns all open orders, optionally filtered by symbol.',
      querystring: {
        type: 'object',
        required: ['exchange'],
        properties: {
          exchange: { type: 'string', enum: ['mexc', 'gateio', 'bitget', 'kraken'] },
          symbol: { type: 'string', description: 'Filter by trading pair' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            exchange: { type: 'string' },
            orders: { 
              type: 'array', 
              items: { 
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  symbol: { type: 'string' },
                  side: { type: 'string' },
                  type: { type: 'string' },
                  price: { type: 'number' },
                  amount: { type: 'number' },
                  filled: { type: 'number' },
                  remaining: { type: 'number' },
                  status: { type: 'string' },
                  timestamp: { type: 'number' },
                },
              },
            },
            count: { type: 'number' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { exchange, symbol } = request.query;
    try {
      const connector = await ExchangeFactory.getExchange(exchange);
      const orders = await connector.getOpenOrders(symbol);
      return {
        exchange,
        orders: orders.map(transformOrder),
        count: orders.length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.status(500).send({ error: `Failed to fetch orders: ${message}` });
    }
  });

  // GET /orders/:id - Get order by ID (QBT-358)
  app.get<{ Params: OrderParams; Querystring: OrdersQuery }>('/orders/:id', {
    schema: {
      tags: ['Orders'],
      summary: 'Get order by ID',
      description: 'Returns details of a specific order.',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Order ID' },
        },
      },
      querystring: {
        type: 'object',
        required: ['exchange', 'symbol'],
        properties: {
          exchange: { type: 'string', enum: ['mexc', 'gateio', 'bitget', 'kraken'] },
          symbol: { type: 'string', description: 'Trading pair (required for most exchanges)' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { exchange, symbol } = request.query;
    if (!symbol) {
      return reply.status(400).send({ error: 'symbol is required' });
    }
    try {
      const connector = await ExchangeFactory.getExchange(exchange);
      const order = await connector.getOrder(id, symbol);
      return { exchange, order: transformOrder(order) };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.status(500).send({ error: `Failed to fetch order: ${message}` });
    }
  });

  // POST /orders - Create order (QBT-359)
  app.post<{ Body: CreateOrderBody }>('/orders', {
    schema: {
      tags: ['Orders'],
      summary: 'Create a new order',
      description: 'Places a limit or market order on the specified exchange.',
      body: {
        type: 'object',
        required: ['exchange', 'symbol', 'side', 'amount'],
        properties: {
          exchange: { type: 'string', enum: ['mexc', 'gateio', 'bitget', 'kraken'] },
          symbol: { type: 'string', example: 'BTC/USDT' },
          side: { type: 'string', enum: ['buy', 'sell'] },
          type: { type: 'string', enum: ['limit', 'market'], default: 'limit' },
          amount: { type: 'number', minimum: 0 },
          price: { type: 'number', minimum: 0, description: 'Required for limit orders' },
        },
      },
    },
  }, async (request, reply) => {
    const { exchange, symbol, side, type = 'limit', amount, price } = request.body;
    
    if (type === 'limit' && !price) {
      return reply.status(400).send({ error: 'price is required for limit orders' });
    }
    
    try {
      const connector = await ExchangeFactory.getExchange(exchange);
      const order = await connector.createOrder(symbol, type, side, amount, price);
      return { exchange, order: transformOrder(order), message: 'Order created successfully' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.status(500).send({ error: `Failed to create order: ${message}` });
    }
  });

  // DELETE /orders/:id - Cancel order (QBT-360)
  app.delete<{ Params: OrderParams; Body: CancelOrderBody }>('/orders/:id', {
    schema: {
      tags: ['Orders'],
      summary: 'Cancel an order',
      description: 'Cancels a specific order by ID.',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['exchange', 'symbol'],
        properties: {
          exchange: { type: 'string', enum: ['mexc', 'gateio', 'bitget', 'kraken'] },
          symbol: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { exchange, symbol } = request.body;
    try {
      const connector = await ExchangeFactory.getExchange(exchange);
      await connector.cancelOrder(id, symbol);
      return { success: true, message: `Order ${id} cancelled` };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.status(500).send({ error: `Failed to cancel order: ${message}` });
    }
  });

  // DELETE /orders - Cancel all orders (QBT-361)
  app.delete<{ Body: CancelOrderBody }>('/orders', {
    schema: {
      tags: ['Orders'],
      summary: 'Cancel all orders',
      description: 'Cancels all open orders for a symbol.',
      body: {
        type: 'object',
        required: ['exchange', 'symbol'],
        properties: {
          exchange: { type: 'string', enum: ['mexc', 'gateio', 'bitget', 'kraken'] },
          symbol: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { exchange, symbol } = request.body;
    try {
      const connector = await ExchangeFactory.getExchange(exchange);
      await connector.cancelAllOrders(symbol);
      return { success: true, message: `All orders for ${symbol} cancelled` };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.status(500).send({ error: `Failed to cancel orders: ${message}` });
    }
  });
}

// Helper to transform Order to response format
function transformOrder(order: Order): OrderResponse {
  return {
    id: order.id,
    symbol: order.symbol,
    side: order.side,
    type: order.type,
    price: order.price ?? 0,
    amount: order.amount,
    filled: order.filled,
    remaining: order.remaining,
    status: order.status,
    timestamp: order.timestamp,
  };
}
