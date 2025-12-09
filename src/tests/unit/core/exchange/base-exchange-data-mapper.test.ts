import { BaseExchangeDataMapper } from '../../../../core/exchange/base-exchange-data-mapper';
import { Order, Balance, Ticker, OrderBook, Trade } from '../../../../types';

interface MockRawOrder {
  id: string;
  symbol: string;
  type: string;
  side: string;
  amount: string;
  price: string;
  status: string;
  timestamp: number;
}

interface MockRawBalance {
  asset: string;
  free: string;
  locked: string;
}

interface MockRawTicker {
  symbol: string;
  bidPrice: string;
  askPrice: string;
  lastPrice: string;
  timestamp: number;
}

interface MockRawOrderBook {
  symbol: string;
  bids: [string, string][];
  asks: [string, string][];
  timestamp: number;
}

interface MockRawTrade {
  id: string;
  price: string;
  quantity: string;
  side: string;
  timestamp: number;
}

interface MockRawAccount {
  balances: MockRawBalance[];
}

class MockExchangeDataMapper extends BaseExchangeDataMapper<
  MockRawOrder,
  MockRawBalance,
  MockRawTicker,
  MockRawOrderBook,
  MockRawTrade,
  MockRawAccount
> {
  mapOrder(exchangeOrder: MockRawOrder): Order {
    return {
      id: exchangeOrder.id,
      symbol: this.normalizeSymbol(exchangeOrder.symbol),
      type: exchangeOrder.type as any,
      side: exchangeOrder.side as any,
      amount: this.parseAmount(exchangeOrder.amount),
      price: this.parsePrice(exchangeOrder.price),
      status: exchangeOrder.status as any,
      timestamp: this.parseTimestamp(exchangeOrder.timestamp),
      filled: 0,
      remaining: this.parseAmount(exchangeOrder.amount)
    };
  }

  mapBalance(exchangeBalance: MockRawBalance): Balance {
    const free = this.parseAmount(exchangeBalance.free);
    const used = this.parseAmount(exchangeBalance.locked);
    return {
      asset: exchangeBalance.asset,
      free,
      used,
      total: free + used,
      available: free
    };
  }

  mapTicker(exchangeTicker: MockRawTicker): Ticker {
    return {
      symbol: this.normalizeSymbol(exchangeTicker.symbol),
      bid: this.parsePrice(exchangeTicker.bidPrice),
      ask: this.parsePrice(exchangeTicker.askPrice),
      last: this.parsePrice(exchangeTicker.lastPrice),
      baseVolume: 0,
      timestamp: this.parseTimestamp(exchangeTicker.timestamp)
    };
  }

  mapOrderBook(exchangeOrderBook: MockRawOrderBook, symbol: string): OrderBook {
    return {
      symbol: this.normalizeSymbol(symbol),
      bids: this.parseOrderBookEntries(exchangeOrderBook.bids),
      asks: this.parseOrderBookEntries(exchangeOrderBook.asks),
      timestamp: this.parseTimestamp(exchangeOrderBook.timestamp)
    };
  }

  mapTrade(exchangeTrade: MockRawTrade, symbol: string): Trade {
    return {
      id: exchangeTrade.id,
      symbol: this.normalizeSymbol(symbol),
      price: this.parsePrice(exchangeTrade.price),
      amount: this.parseAmount(exchangeTrade.quantity),
      side: exchangeTrade.side as any,
      timestamp: this.parseTimestamp(exchangeTrade.timestamp)
    };
  }

  mapAccountBalances(exchangeAccount: MockRawAccount): Record<string, Balance> {
    const balances: Record<string, Balance> = {};
    exchangeAccount.balances.forEach(balance => {
      balances[balance.asset] = this.mapBalance(balance);
    });
    return balances;
  }

  testParseTimestamp(timestamp: string | number | undefined | null): number {
    return this.parseTimestamp(timestamp);
  }

  testParsePrice(price: string | number | undefined | null): number {
    return this.parsePrice(price);
  }

  testParseAmount(amount: string | number | undefined | null): number {
    return this.parseAmount(amount);
  }

  testNormalizeSymbol(symbol: string): string {
    return this.normalizeSymbol(symbol);
  }

  testParseOrderBookEntries(entries: [string, string][]): Array<{ price: number; amount: number }> {
    return this.parseOrderBookEntries(entries);
  }
}

describe('BaseExchangeDataMapper', () => {
  let mapper: MockExchangeDataMapper;

  beforeEach(() => {
    mapper = new MockExchangeDataMapper();
  });

  describe('parseTimestamp', () => {
    it('should parse number timestamps correctly', () => {
      expect(mapper.testParseTimestamp(1234567890)).toBe(1234567890);
    });

    it('should parse string timestamps correctly', () => {
      expect(mapper.testParseTimestamp('1234567890')).toBe(1234567890);
    });

    it('should return current time for invalid timestamps', () => {
      const before = Date.now();
      const result1 = mapper.testParseTimestamp(undefined);
      const result2 = mapper.testParseTimestamp(null);
      const result3 = mapper.testParseTimestamp('invalid');
      const after = Date.now();

      expect(result1).toBeGreaterThanOrEqual(before);
      expect(result1).toBeLessThanOrEqual(after);
      expect(result2).toBeGreaterThanOrEqual(before);
      expect(result2).toBeLessThanOrEqual(after);
      expect(result3).toBeGreaterThanOrEqual(before);
      expect(result3).toBeLessThanOrEqual(after);
    });
  });

  describe('parsePrice', () => {
    it('should parse number prices correctly', () => {
      expect(mapper.testParsePrice(123.45)).toBe(123.45);
    });

    it('should parse string prices correctly', () => {
      expect(mapper.testParsePrice('123.45')).toBe(123.45);
    });

    it('should return 0 for invalid prices', () => {
      expect(mapper.testParsePrice(undefined)).toBe(0);
      expect(mapper.testParsePrice(null)).toBe(0);
      expect(mapper.testParsePrice('invalid')).toBe(0);
    });

    it('should handle edge cases', () => {
      expect(mapper.testParsePrice('0')).toBe(0);
      expect(mapper.testParsePrice(0)).toBe(0);
      expect(mapper.testParsePrice('0.0')).toBe(0);
    });
  });

  describe('parseAmount', () => {
    it('should parse number amounts correctly', () => {
      expect(mapper.testParseAmount(67.89)).toBe(67.89);
    });

    it('should parse string amounts correctly', () => {
      expect(mapper.testParseAmount('67.89')).toBe(67.89);
    });

    it('should return 0 for invalid amounts', () => {
      expect(mapper.testParseAmount(undefined)).toBe(0);
      expect(mapper.testParseAmount(null)).toBe(0);
      expect(mapper.testParseAmount('invalid')).toBe(0);
    });

    it('should handle edge cases', () => {
      expect(mapper.testParseAmount('0')).toBe(0);
      expect(mapper.testParseAmount(0)).toBe(0);
      expect(mapper.testParseAmount('0.0')).toBe(0);
    });
  });

  describe('normalizeSymbol', () => {
    it('should convert symbols to uppercase', () => {
      expect(mapper.testNormalizeSymbol('btcusdt')).toBe('BTCUSDT');
      expect(mapper.testNormalizeSymbol('BtcUsdt')).toBe('BTCUSDT');
      expect(mapper.testNormalizeSymbol('BTCUSDT')).toBe('BTCUSDT');
    });

    it('should handle special characters', () => {
      expect(mapper.testNormalizeSymbol('btc-usdt')).toBe('BTC-USDT');
      expect(mapper.testNormalizeSymbol('btc_usdt')).toBe('BTC_USDT');
    });
  });

  describe('parseOrderBookEntries', () => {
    it('should parse valid order book entries', () => {
      const entries: [string, string][] = [
        ['100.50', '1.5'],
        ['100.00', '2.0']
      ];

      const result = mapper.testParseOrderBookEntries(entries);

      expect(result).toEqual([
        { price: 100.50, amount: 1.5 },
        { price: 100.00, amount: 2.0 }
      ]);
    });

    it('should handle invalid entries gracefully', () => {
      const entries: [string, string][] = [
        ['invalid', '1.5'],
        ['100.00', 'invalid']
      ];

      const result = mapper.testParseOrderBookEntries(entries);

      expect(result).toEqual([
        { price: 0, amount: 1.5 },
        { price: 100.00, amount: 0 }
      ]);
    });

    it('should handle empty entries array', () => {
      const result = mapper.testParseOrderBookEntries([]);
      expect(result).toEqual([]);
    });
  });

  describe('mapOrder', () => {
    it('should map exchange order to OpenMM Order format', () => {
      const exchangeOrder: MockRawOrder = {
        id: 'order123',
        symbol: 'btcusdt',
        type: 'limit',
        side: 'buy',
        amount: '1.5',
        price: '50000.00',
        status: 'filled',
        timestamp: 1234567890
      };

      const result = mapper.mapOrder(exchangeOrder);

      expect(result).toEqual({
        id: 'order123',
        symbol: 'BTCUSDT',
        type: 'limit',
        side: 'buy',
        amount: 1.5,
        price: 50000.00,
        status: 'filled',
        timestamp: 1234567890,
        filled: 0,
        remaining: 1.5
      });
    });
  });

  describe('mapBalance', () => {
    it('should map exchange balance to OpenMM Balance format', () => {
      const exchangeBalance: MockRawBalance = {
        asset: 'BTC',
        free: '1.5',
        locked: '0.5'
      };

      const result = mapper.mapBalance(exchangeBalance);

      expect(result).toEqual({
        asset: 'BTC',
        free: 1.5,
        used: 0.5,
        total: 2.0,
        available: 1.5
      });
    });
  });

  describe('mapTicker', () => {
    it('should map exchange ticker to OpenMM Ticker format', () => {
      const exchangeTicker: MockRawTicker = {
        symbol: 'btcusdt',
        bidPrice: '49999.00',
        askPrice: '50001.00',
        lastPrice: '50000.00',
        timestamp: 1234567890
      };

      const result = mapper.mapTicker(exchangeTicker);

      expect(result).toEqual({
        symbol: 'BTCUSDT',
        bid: 49999.00,
        ask: 50001.00,
        last: 50000.00,
        baseVolume: 0,
        timestamp: 1234567890
      });
    });
  });

  describe('mapOrderBook', () => {
    it('should map exchange orderbook to OpenMM OrderBook format', () => {
      const exchangeOrderBook: MockRawOrderBook = {
        symbol: 'btcusdt',
        bids: [['50000.00', '1.0'], ['49999.00', '2.0']],
        asks: [['50001.00', '1.5'], ['50002.00', '2.5']],
        timestamp: 1234567890
      };

      const result = mapper.mapOrderBook(exchangeOrderBook, 'btcusdt');

      expect(result).toEqual({
        symbol: 'BTCUSDT',
        bids: [
          { price: 50000.00, amount: 1.0 },
          { price: 49999.00, amount: 2.0 }
        ],
        asks: [
          { price: 50001.00, amount: 1.5 },
          { price: 50002.00, amount: 2.5 }
        ],
        timestamp: 1234567890
      });
    });
  });

  describe('mapTrade', () => {
    it('should map exchange trade to OpenMM Trade format', () => {
      const exchangeTrade: MockRawTrade = {
        id: 'trade123',
        price: '50000.00',
        quantity: '1.5',
        side: 'buy',
        timestamp: 1234567890
      };

      const result = mapper.mapTrade(exchangeTrade, 'btcusdt');

      expect(result).toEqual({
        id: 'trade123',
        symbol: 'BTCUSDT',
        price: 50000.00,
        amount: 1.5,
        side: 'buy',
        timestamp: 1234567890
      });
    });
  });

  describe('mapAccountBalances', () => {
    it('should map exchange account to OpenMM Balance records', () => {
      const exchangeAccount: MockRawAccount = {
        balances: [
          { asset: 'BTC', free: '1.5', locked: '0.5' },
          { asset: 'USDT', free: '1000.0', locked: '0.0' }
        ]
      };

      const result = mapper.mapAccountBalances(exchangeAccount);

      expect(result).toEqual({
        BTC: {
          asset: 'BTC',
          free: 1.5,
          used: 0.5,
          total: 2.0,
          available: 1.5
        },
        USDT: {
          asset: 'USDT',
          free: 1000.0,
          used: 0.0,
          total: 1000.0,
          available: 1000.0
        }
      });
    });

    it('should handle empty balances array', () => {
      const exchangeAccount: MockRawAccount = {
        balances: []
      };

      const result = mapper.mapAccountBalances(exchangeAccount);
      expect(result).toEqual({});
    });
  });
});