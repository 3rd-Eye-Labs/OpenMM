import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ExchangeFactory, SupportedExchange } from '../../cli/exchange-factory';

const ExchangeParam = z.string().describe(
  'Exchange to query. Supported: mexc, gateio, bitget, kraken'
);

const SymbolParam = z.string().describe(
  'Trading pair symbol (e.g., BTC/USDT, INDY/USDT)'
);

function validateExchange(exchange: string): SupportedExchange {
  if (!ExchangeFactory.isSupported(exchange)) {
    const supported = ExchangeFactory.getSupportedExchanges().join(', ');
    throw new Error(
      `Unsupported exchange: ${exchange}. Supported: ${supported}`
    );
  }
  return exchange as SupportedExchange;
}

function validateSymbol(symbol: string): string {
  if (!symbol) {
    throw new Error('Symbol is required');
  }
  const upper = symbol.toUpperCase();
  if (!/^[A-Z]+\/[A-Z]+$/.test(upper) && !/^[A-Z]+[A-Z]+$/.test(upper)) {
    throw new Error(`Invalid symbol format: ${symbol}. Expected: BTC/USDT or BTCUSDT`);
  }
  return upper;
}

export function registerMarketDataTools(server: McpServer): void {
  server.tool(
    'get_ticker',
    'Get real-time price, 24h high/low, and volume for a trading pair on a supported exchange',
    {
      exchange: ExchangeParam,
      symbol: SymbolParam,
    },
    async ({ exchange, symbol }) => {
      const validExchange = validateExchange(exchange);
      const validSymbol = validateSymbol(symbol);

      const connector = await ExchangeFactory.getExchange(validExchange);
      const ticker = await connector.getTicker(validSymbol);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                symbol: ticker.symbol,
                last: ticker.last,
                bid: ticker.bid,
                ask: ticker.ask,
                spread: ticker.ask - ticker.bid,
                spreadPercent: ((ticker.ask - ticker.bid) / ticker.ask) * 100,
                baseVolume: ticker.baseVolume,
                quoteVolume: ticker.quoteVolume,
                timestamp: ticker.timestamp,
                exchange: validExchange,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    'get_orderbook',
    'Fetch order book depth (bids and asks) for a trading pair on a supported exchange',
    {
      exchange: ExchangeParam,
      symbol: SymbolParam,
      limit: z.number().min(1).max(100).default(10).describe(
        'Number of bid/ask levels to return (default: 10, max: 100)'
      ),
    },
    async ({ exchange, symbol, limit }) => {
      const validExchange = validateExchange(exchange);
      const validSymbol = validateSymbol(symbol);

      const connector = await ExchangeFactory.getExchange(validExchange);
      const orderbook = await connector.getOrderBook(validSymbol);

      const bids = orderbook.bids.slice(0, limit);
      const asks = orderbook.asks.slice(0, limit);

      const spread =
        orderbook.asks.length > 0 && orderbook.bids.length > 0
          ? orderbook.asks[0].price - orderbook.bids[0].price
          : null;
      const spreadPercent =
        spread !== null && orderbook.asks[0].price > 0
          ? (spread / orderbook.asks[0].price) * 100
          : null;

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                symbol: orderbook.symbol,
                bids,
                asks,
                spread,
                spreadPercent,
                bidLevels: bids.length,
                askLevels: asks.length,
                timestamp: orderbook.timestamp,
                exchange: validExchange,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    'get_trades',
    'Get recent trades for a trading pair on a supported exchange',
    {
      exchange: ExchangeParam,
      symbol: SymbolParam,
      limit: z.number().min(1).max(100).default(20).describe(
        'Number of recent trades to return (default: 20, max: 100)'
      ),
    },
    async ({ exchange, symbol, limit }) => {
      const validExchange = validateExchange(exchange);
      const validSymbol = validateSymbol(symbol);

      const connector = await ExchangeFactory.getExchange(validExchange);
      const trades = await connector.getRecentTrades(validSymbol);

      const limitedTrades = trades.slice(0, limit);

      const buyTrades = limitedTrades.filter(t => t.side === 'buy');
      const sellTrades = limitedTrades.filter(t => t.side === 'sell');
      const totalVolume = limitedTrades.reduce(
        (sum, trade) => sum + trade.price * trade.amount,
        0
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                symbol: validSymbol,
                trades: limitedTrades,
                summary: {
                  totalTrades: limitedTrades.length,
                  buyTrades: buyTrades.length,
                  sellTrades: sellTrades.length,
                  totalVolume,
                },
                exchange: validExchange,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
