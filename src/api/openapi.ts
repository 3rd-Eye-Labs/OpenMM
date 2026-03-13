import { FastifyDynamicSwaggerOptions } from '@fastify/swagger';

export const openApiConfig: FastifyDynamicSwaggerOptions = {
  openapi: {
    info: {
      title: 'OpenMM API',
      description: `
OpenMM - Universal Market Making Toolkit API

A powerful REST API for automated trading, market making, and portfolio management across multiple exchanges.

## Features
- **Multi-Exchange Support**: MEXC, Gate.io, Bitget, Kraken
- **Order Management**: Place, cancel, and track orders
- **Market Data**: Real-time ticker, orderbook, and trades
- **Grid Strategies**: Automated grid trading strategies
- **Cardano DEX**: Token prices and pool discovery via Iris Protocol
- **Cross-Exchange**: Price comparison and arbitrage detection

## Authentication
All trading endpoints require exchange API credentials configured in the server environment.

## Rate Limits
Rate limits are inherited from the underlying exchanges. The API implements intelligent rate limiting and caching.
      `,
      version: '1.0.0',
      contact: {
        name: 'QBT Labs',
        url: 'https://qbtlabs.io',
        email: 'support@qbtlabs.io',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local development server',
      },
      {
        url: 'https://api.openmm.io',
        description: 'Production server',
      },
    ],
    tags: [
      { name: 'Health', description: 'Health check and status endpoints' },
      { name: 'Account', description: 'Account balances and information' },
      { name: 'Market Data', description: 'Ticker, orderbook, and trade data' },
      { name: 'Orders', description: 'Order management (place, cancel, list)' },
      { name: 'Strategy', description: 'Grid and other trading strategies' },
      { name: 'Cardano', description: 'Cardano DEX prices and pool discovery' },
      { name: 'Price', description: 'Cross-exchange price comparison' },
    ],
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'Error message' },
            code: { type: 'string', description: 'Error code' },
          },
          required: ['error'],
        },
        Exchange: {
          type: 'string',
          enum: ['mexc', 'gateio', 'bitget', 'kraken'],
          description: 'Supported exchange identifier',
        },
        Balance: {
          type: 'object',
          properties: {
            asset: { type: 'string', example: 'BTC' },
            free: { type: 'string', example: '1.5' },
            locked: { type: 'string', example: '0.5' },
            total: { type: 'string', example: '2.0' },
          },
          required: ['asset', 'free', 'locked', 'total'],
        },
        Ticker: {
          type: 'object',
          properties: {
            symbol: { type: 'string', example: 'BTC/USDT' },
            last: { type: 'number', example: 42000.5 },
            bid: { type: 'number', example: 42000.0 },
            ask: { type: 'number', example: 42001.0 },
            high24h: { type: 'number', example: 43000.0 },
            low24h: { type: 'number', example: 41000.0 },
            volume24h: { type: 'number', example: 1234.56 },
            change24h: { type: 'number', example: 2.5 },
            timestamp: { type: 'number', example: 1699900000000 },
          },
          required: ['symbol', 'last', 'bid', 'ask'],
        },
        OrderBookEntry: {
          type: 'object',
          properties: {
            price: { type: 'number', example: 42000.0 },
            amount: { type: 'number', example: 1.5 },
          },
          required: ['price', 'amount'],
        },
        OrderBook: {
          type: 'object',
          properties: {
            symbol: { type: 'string', example: 'BTC/USDT' },
            bids: {
              type: 'array',
              items: { $ref: '#/components/schemas/OrderBookEntry' },
            },
            asks: {
              type: 'array',
              items: { $ref: '#/components/schemas/OrderBookEntry' },
            },
            timestamp: { type: 'number', example: 1699900000000 },
          },
          required: ['symbol', 'bids', 'asks'],
        },
        Trade: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '123456' },
            symbol: { type: 'string', example: 'BTC/USDT' },
            side: { type: 'string', enum: ['buy', 'sell'] },
            price: { type: 'number', example: 42000.0 },
            amount: { type: 'number', example: 0.1 },
            timestamp: { type: 'number', example: 1699900000000 },
          },
          required: ['id', 'symbol', 'side', 'price', 'amount', 'timestamp'],
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'order-123' },
            symbol: { type: 'string', example: 'BTC/USDT' },
            side: { type: 'string', enum: ['buy', 'sell'] },
            type: { type: 'string', enum: ['limit', 'market'] },
            price: { type: 'number', example: 42000.0 },
            amount: { type: 'number', example: 0.1 },
            filled: { type: 'number', example: 0.05 },
            status: { type: 'string', enum: ['open', 'filled', 'cancelled', 'partial'] },
            timestamp: { type: 'number', example: 1699900000000 },
          },
          required: ['id', 'symbol', 'side', 'type', 'amount', 'status'],
        },
        CreateOrderRequest: {
          type: 'object',
          properties: {
            exchange: { $ref: '#/components/schemas/Exchange' },
            symbol: { type: 'string', example: 'BTC/USDT' },
            side: { type: 'string', enum: ['buy', 'sell'] },
            type: { type: 'string', enum: ['limit', 'market'], default: 'limit' },
            price: { type: 'number', example: 42000.0 },
            amount: { type: 'number', example: 0.1 },
          },
          required: ['exchange', 'symbol', 'side', 'amount'],
        },
        GridStrategyConfig: {
          type: 'object',
          properties: {
            exchange: { $ref: '#/components/schemas/Exchange' },
            symbol: { type: 'string', example: 'BTC/USDT' },
            lowerPrice: { type: 'number', example: 40000 },
            upperPrice: { type: 'number', example: 44000 },
            gridCount: { type: 'integer', example: 10 },
            totalAmount: { type: 'number', example: 1.0 },
          },
          required: ['exchange', 'symbol', 'lowerPrice', 'upperPrice', 'gridCount', 'totalAmount'],
        },
        GridStrategyStatus: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'grid-123' },
            status: { type: 'string', enum: ['running', 'stopped', 'error'] },
            symbol: { type: 'string', example: 'BTC/USDT' },
            openOrders: { type: 'integer', example: 8 },
            filledOrders: { type: 'integer', example: 12 },
            profit: { type: 'number', example: 150.25 },
            createdAt: { type: 'number', example: 1699900000000 },
          },
          required: ['id', 'status', 'symbol'],
        },
        CardanoPrice: {
          type: 'object',
          properties: {
            symbol: { type: 'string', example: 'SNEK' },
            priceAda: { type: 'number', example: 0.00012 },
            priceUsdt: { type: 'number', example: 0.000045 },
            adaPrice: { type: 'number', example: 0.38 },
            source: { type: 'string', example: 'iris' },
          },
          required: ['symbol', 'priceAda', 'priceUsdt'],
        },
        DexPool: {
          type: 'object',
          properties: {
            dex: { type: 'string', example: 'minswap' },
            poolId: { type: 'string' },
            tokenA: { type: 'string', example: 'ADA' },
            tokenB: { type: 'string', example: 'SNEK' },
            reserveA: { type: 'number' },
            reserveB: { type: 'number' },
            tvl: { type: 'number', example: 1500000 },
            volume24h: { type: 'number', example: 250000 },
          },
          required: ['dex', 'poolId', 'tokenA', 'tokenB'],
        },
      },
    },
  },
};
