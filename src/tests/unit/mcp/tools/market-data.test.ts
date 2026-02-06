import { createServer } from '../../../../mcp/server';
import { ExchangeFactory } from '../../../../cli/exchange-factory';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

jest.mock('../../../../cli/exchange-factory');

const mockExchangeFactory = ExchangeFactory as jest.Mocked<typeof ExchangeFactory>;

interface TextContent {
  type: 'text';
  text: string;
}

function parseResult(result: Awaited<ReturnType<Client['callTool']>>): any {
  const content = result.content as TextContent[];
  return JSON.parse(content[0].text);
}

describe('Market Data MCP Tools', () => {
  let client: Client;

  const mockTicker = {
    symbol: 'INDY/USDT',
    last: 0.0342,
    bid: 0.034,
    ask: 0.0344,
    baseVolume: 2400000,
    quoteVolume: 82080,
    timestamp: Date.now(),
  };

  const mockOrderBook = {
    symbol: 'INDY/USDT',
    bids: [
      { price: 0.034, amount: 1000 },
      { price: 0.0339, amount: 2000 },
      { price: 0.0338, amount: 3000 },
    ],
    asks: [
      { price: 0.0344, amount: 1500 },
      { price: 0.0345, amount: 2500 },
      { price: 0.0346, amount: 3500 },
    ],
    timestamp: Date.now(),
  };

  const mockTrades = [
    { id: '1', symbol: 'INDY/USDT', side: 'buy' as const, amount: 100, price: 0.0342, timestamp: Date.now() },
    { id: '2', symbol: 'INDY/USDT', side: 'sell' as const, amount: 200, price: 0.0341, timestamp: Date.now() },
    { id: '3', symbol: 'INDY/USDT', side: 'buy' as const, amount: 150, price: 0.0343, timestamp: Date.now() },
  ];

  const mockConnector = {
    getTicker: jest.fn().mockResolvedValue(mockTicker),
    getOrderBook: jest.fn().mockResolvedValue(mockOrderBook),
    getRecentTrades: jest.fn().mockResolvedValue(mockTrades),
  };

  beforeAll(async () => {
    mockExchangeFactory.isSupported.mockReturnValue(true);
    mockExchangeFactory.getSupportedExchanges.mockReturnValue(['mexc', 'gateio', 'bitget', 'kraken']);
    mockExchangeFactory.getExchange.mockResolvedValue(mockConnector as any);

    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    client = new Client({ name: 'test-client', version: '1.0.0' });
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
  });

  afterAll(async () => {
    await client.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockExchangeFactory.isSupported.mockReturnValue(true);
    mockExchangeFactory.getSupportedExchanges.mockReturnValue(['mexc', 'gateio', 'bitget', 'kraken']);
    mockExchangeFactory.getExchange.mockResolvedValue(mockConnector as any);
  });

  describe('get_ticker', () => {
    it('should return ticker data for a valid exchange and symbol', async () => {
      const result = await client.callTool({
        name: 'get_ticker',
        arguments: { exchange: 'mexc', symbol: 'INDY/USDT' },
      });

      const data = parseResult(result);
      expect(data.symbol).toBe('INDY/USDT');
      expect(data.last).toBe(0.0342);
      expect(data.bid).toBe(0.034);
      expect(data.ask).toBe(0.0344);
      expect(data.exchange).toBe('mexc');
      expect(data.spread).toBeCloseTo(0.0004);
    });

    it('should reject unsupported exchange', async () => {
      mockExchangeFactory.isSupported.mockReturnValue(false);

      const result = await client.callTool({
        name: 'get_ticker',
        arguments: { exchange: 'binance', symbol: 'BTC/USDT' },
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('get_orderbook', () => {
    it('should return order book with default limit', async () => {
      const result = await client.callTool({
        name: 'get_orderbook',
        arguments: { exchange: 'mexc', symbol: 'INDY/USDT' },
      });

      const data = parseResult(result);
      expect(data.symbol).toBe('INDY/USDT');
      expect(data.bids).toHaveLength(3);
      expect(data.asks).toHaveLength(3);
      expect(data.spread).toBeCloseTo(0.0004);
      expect(data.exchange).toBe('mexc');
    });

    it('should respect limit parameter', async () => {
      const result = await client.callTool({
        name: 'get_orderbook',
        arguments: { exchange: 'mexc', symbol: 'INDY/USDT', limit: 2 },
      });

      const data = parseResult(result);
      expect(data.bids).toHaveLength(2);
      expect(data.asks).toHaveLength(2);
    });
  });

  describe('get_trades', () => {
    it('should return recent trades with summary', async () => {
      const result = await client.callTool({
        name: 'get_trades',
        arguments: { exchange: 'mexc', symbol: 'INDY/USDT' },
      });

      const data = parseResult(result);
      expect(data.trades).toHaveLength(3);
      expect(data.summary.totalTrades).toBe(3);
      expect(data.summary.buyTrades).toBe(2);
      expect(data.summary.sellTrades).toBe(1);
      expect(data.exchange).toBe('mexc');
    });

    it('should respect limit parameter', async () => {
      const result = await client.callTool({
        name: 'get_trades',
        arguments: { exchange: 'mexc', symbol: 'INDY/USDT', limit: 1 },
      });

      const data = parseResult(result);
      expect(data.trades).toHaveLength(1);
      expect(data.summary.totalTrades).toBe(1);
    });
  });
});
