import { MexcDataMapper } from '../../../../exchanges/mexc/mexc-data-mapper';
import {
  MexcRawOrder,
  MexcRawBalance,
  MexcRawAccount,
  MexcRawPrice,
  MexcRaw24hrStats,
  MexcRawOrderBook,
  MexcRawTrade
} from '../../../../types';

describe('MexcDataMapper', () => {
  let mapper: MexcDataMapper;
  beforeEach(() => {
    mapper = new MexcDataMapper();
  });

  describe('mapOrder', () => {
    it('should map MEXC order to OpenMM format with all fields', () => {
      const mexcOrder: MexcRawOrder = {
        orderId: '12345',
        symbol: 'BTCUSDT',
        type: 'LIMIT',
        side: 'BUY',
        origQty: '1.5',
        executedQty: '0.5',
        price: '50000.00',
        status: 'PARTIALLY_FILLED',
        time: 1640995200000,
        updateTime: 1640995300000
      };
      const result = mapper.mapOrder(mexcOrder);
      expect(result).toEqual({
        id: '12345',
        symbol: 'BTCUSDT',
        type: 'limit',
        side: 'buy',
        amount: 1.5,
        price: 50000,
        filled: 0.5,
        remaining: 1.0,
        status: 'open',
        timestamp: 1640995200000
      });
    });

    it('should handle order with minimal data', () => {
      const mexcOrder: MexcRawOrder = {
        symbol: 'ETHUSDT',
        status: 'NEW',
        type: 'LIMIT',
        side: 'BUY'
      };
      const result = mapper.mapOrder(mexcOrder);
      expect(result.symbol).toBe('ETHUSDT');
      expect(result.type).toBe('limit');
      expect(result.side).toBe('buy');
      expect(result.amount).toBe(0);
      expect(result.filled).toBe(0);
      expect(result.status).toBe('open');
    });

    it('should handle order with alternative field names', () => {
      const mexcOrder: MexcRawOrder = {
        id: '67890',
        symbol: 'ADAUSDT',
        type: 'LIMIT',
        side: 'BUY',
        quantity: '100',
        executedQty: '25',
        status: 'FILLED'
      };
      const result = mapper.mapOrder(mexcOrder);
      expect(result.id).toBe('67890');
      expect(result.amount).toBe(100);
      expect(result.filled).toBe(25);
      expect(result.remaining).toBe(75);
      expect(result.status).toBe('filled');
    });

    it('should handle order without price', () => {
      const mexcOrder: MexcRawOrder = {
        orderId: '11111',
        symbol: 'BTCUSDT',
        type: 'MARKET',
        side: 'SELL',
        origQty: '2.0',
        executedQty: '2.0',
        status: 'FILLED'
      };
      const result = mapper.mapOrder(mexcOrder);
      expect(result.type).toBe('market');
      expect(result.price).toBeUndefined();
    });

    it('should throw error for null/undefined order', () => {
      expect(() => mapper.mapOrder(null as any)).toThrow('MEXC order data is required');
      expect(() => mapper.mapOrder(undefined as any)).toThrow('MEXC order data is required');
    });

    it('should handle string numbers correctly', () => {
      const mexcOrder: MexcRawOrder = {
        orderId: '22222',
        symbol: 'ETHUSDT',
        type: 'LIMIT',
        side: 'SELL',
        status: 'PARTIALLY_FILLED',
        origQty: '1.23456789',
        executedQty: '0.12345678',
        price: '3000.12345678'
      };
      const result = mapper.mapOrder(mexcOrder);
      expect(result.amount).toBe(1.23456789);
      expect(result.filled).toBe(0.12345678);
      expect(result.price).toBe(3000.12345678);
    });
  });

  describe('mapToOrderStatus', () => {
    it('should map NEW status to open', () => {
      expect(MexcDataMapper.mapToOrderStatus('NEW')).toBe('open');
      expect(MexcDataMapper.mapToOrderStatus('new')).toBe('open');
    });

    it('should map PARTIAL status to open', () => {
      expect(MexcDataMapper.mapToOrderStatus('PARTIALLY_FILLED')).toBe('open');
      expect(MexcDataMapper.mapToOrderStatus('PARTIAL_FILL')).toBe('open');
    });

    it('should map FILL status to filled', () => {
      expect(MexcDataMapper.mapToOrderStatus('FILLED')).toBe('filled');
      expect(MexcDataMapper.mapToOrderStatus('FULL_FILL')).toBe('filled');
    });

    it('should map CANCEL status to cancelled', () => {
      expect(MexcDataMapper.mapToOrderStatus('CANCELED')).toBe('cancelled');
      expect(MexcDataMapper.mapToOrderStatus('CANCELLED')).toBe('cancelled');
    });

    it('should map REJECT status to rejected', () => {
      expect(MexcDataMapper.mapToOrderStatus('REJECTED')).toBe('rejected');
      expect(MexcDataMapper.mapToOrderStatus('EXPIRED')).toBe('rejected');
    });

    it('should map EXEC status to filled', () => {
      expect(MexcDataMapper.mapToOrderStatus('EXECUTED')).toBe('filled');
      expect(MexcDataMapper.mapToOrderStatus('EXEC_TRADE')).toBe('filled');
    });

    it('should default unknown status to open', () => {
      expect(MexcDataMapper.mapToOrderStatus('UNKNOWN')).toBe('open');
      expect(MexcDataMapper.mapToOrderStatus('')).toBe('open');
    });

    it('should handle case-insensitive status matching', () => {
      expect(MexcDataMapper.mapToOrderStatus('filled')).toBe('filled');
      expect(MexcDataMapper.mapToOrderStatus('Canceled')).toBe('cancelled');
      expect(MexcDataMapper.mapToOrderStatus('REJECTED')).toBe('rejected');
    });
  });

  describe('mapBalance', () => {
    it('should map MEXC balance to OpenMM format', () => {
      const mexcBalance: MexcRawBalance = {
        asset: 'BTC',
        free: '1.5',
        locked: '0.5'
      };
      const result = mapper.mapBalance(mexcBalance);
      expect(result).toEqual({
        asset: 'BTC',
        free: 1.5,
        used: 0.5,
        total: 2.0,
        available: 1.5
      });
    });

    it('should handle zero balances', () => {
      const mexcBalance: MexcRawBalance = {
        asset: 'ETH',
        free: '0',
        locked: '0'
      };
      const result = mapper.mapBalance(mexcBalance);
      expect(result.free).toBe(0);
      expect(result.used).toBe(0);
      expect(result.total).toBe(0);
      expect(result.available).toBe(0);
    });

    it('should handle missing values gracefully', () => {
      const mexcBalance: MexcRawBalance = {
        asset: 'ADA',
        free: undefined as any,
        locked: undefined as any
      };
      const result = mapper.mapBalance(mexcBalance);
      expect(result.free).toBe(0);
      expect(result.used).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe('mapTicker', () => {
    it('should map price data without stats', () => {
      const tickerData = {
        priceData: {
          symbol: 'BTCUSDT',
          price: '50000.00'
        } as MexcRawPrice
      };
      const result = mapper.mapTicker(tickerData);
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.last).toBe(50000);
      expect(result.bid).toBe(50000);
      expect(result.ask).toBe(50000);
      expect(result.baseVolume).toBe(0);
    });

    it('should map price data with full stats', () => {
      const tickerData = {
        priceData: {
          symbol: 'ETHUSDT',
          price: '3000.00'
        } as MexcRawPrice,
        statsData: {
          bidPrice: '2999.50',
          askPrice: '3000.50',
          volume: '1000.123'
        } as MexcRaw24hrStats
      };
      const result = mapper.mapTicker(tickerData);
      expect(result.symbol).toBe('ETHUSDT');
      expect(result.last).toBe(3000);
      expect(result.bid).toBe(2999.5);
      expect(result.ask).toBe(3000.5);
      expect(result.baseVolume).toBe(1000.123);
      expect(result.timestamp).toBeGreaterThan(0);
    });
  });

  describe('mapOrderBook', () => {
    it('should map MEXC order book to OpenMM format', () => {
      const mexcOrderBook: MexcRawOrderBook = {
        bids: [
          ['49900.00', '1.5'],
          ['49800.00', '2.0']
        ],
        asks: [
          ['50100.00', '1.0'],
          ['50200.00', '0.5']
        ]
      };
      const result = mapper.mapOrderBook(mexcOrderBook, 'BTCUSDT');
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.bids).toEqual([
        { price: 49900, amount: 1.5 },
        { price: 49800, amount: 2.0 }
      ]);
      expect(result.asks).toEqual([
        { price: 50100, amount: 1.0 },
        { price: 50200, amount: 0.5 }
      ]);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('should handle empty order book', () => {
      const mexcOrderBook: MexcRawOrderBook = {
        bids: [],
        asks: []
      };
      const result = mapper.mapOrderBook(mexcOrderBook, 'ETHUSDT');
      expect(result.symbol).toBe('ETHUSDT');
      expect(result.bids).toEqual([]);
      expect(result.asks).toEqual([]);
    });
  });

  describe('mapTrade', () => {
    it('should map MEXC trade with all fields', () => {
      const mexcTrade: MexcRawTrade = {
        id: '12345',
        qty: '1.5',
        price: '50000.00',
        time: 1640995200000,
        isBuyerMaker: false
      };
      const result = mapper.mapTrade(mexcTrade, 'BTCUSDT');
      expect(result).toEqual({
        id: '12345',
        symbol: 'BTCUSDT',
        side: 'buy',
        amount: 1.5,
        price: 50000,
        timestamp: 1640995200000
      });
    });

    it('should handle trade with alternative field names', () => {
      const mexcTrade: MexcRawTrade = {
        tradeId: '67890',
        quantity: '2.0',
        price: '3000.00',
        time: 1640995300000,
        isBuyerMaker: true
      };
      const result = mapper.mapTrade(mexcTrade, 'ETHUSDT');
      expect(result.id).toBe('67890');
      expect(result.side).toBe('sell');
      expect(result.amount).toBe(2.0);
      expect(result.symbol).toBe('ETHUSDT');
    });

    it('should handle missing id', () => {
      const mexcTrade: MexcRawTrade = {
        qty: '1.0',
        price: '1000.00',
        time: 1640995400000,
        isBuyerMaker: false
      };
      const result = mapper.mapTrade(mexcTrade, 'ADAUSDT');
      expect(result.id).toBe('');
      expect(result.symbol).toBe('ADAUSDT');
    });

    it('should determine side based on isBuyerMaker', () => {
      const buyTrade: MexcRawTrade = {
        isBuyerMaker: false,
        qty: '1.0',
        price: '1000.00',
        time: 1640995400000
      };
      const sellTrade: MexcRawTrade = {
        isBuyerMaker: true,
        qty: '1.0',
        price: '1000.00',
        time: 1640995400000
      };
      expect(mapper.mapTrade(buyTrade, 'TEST').side).toBe('buy');
      expect(mapper.mapTrade(sellTrade, 'TEST').side).toBe('sell');
    });
  });

  describe('mapAccountBalances', () => {
    it('should map account balances and filter zero balances', () => {
      const mexcAccount: MexcRawAccount = {
        balances: [
          { asset: 'BTC', free: '1.5', locked: '0.5' },
          { asset: 'ETH', free: '0', locked: '0' },
          { asset: 'ADA', free: '100', locked: '0' },
          { asset: 'DOT', free: '0', locked: '10' }
        ]
      };
      const result = mapper.mapAccountBalances(mexcAccount);
      expect(Object.keys(result)).toHaveLength(3);
      expect(result['BTC']).toEqual({
        asset: 'BTC',
        free: 1.5,
        used: 0.5,
        total: 2.0,
        available: 1.5
      });
      expect(result['ADA']).toEqual({
        asset: 'ADA',
        free: 100,
        used: 0,
        total: 100,
        available: 100
      });
      expect(result['DOT']).toEqual({
        asset: 'DOT',
        free: 0,
        used: 10,
        total: 10,
        available: 0
      });
      expect(result['ETH']).toBeUndefined();
    });

    it('should handle empty account balances', () => {
      const mexcAccount: MexcRawAccount = {
        balances: []
      };
      const result = mapper.mapAccountBalances(mexcAccount);
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should handle account with all zero balances', () => {
      const mexcAccount: MexcRawAccount = {
        balances: [
          { asset: 'BTC', free: '0', locked: '0' },
          { asset: 'ETH', free: '0', locked: '0' }
        ]
      };
      const result = mapper.mapAccountBalances(mexcAccount);
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('normalizeSymbol', () => {
    it('should normalize symbol to uppercase', () => {
      const mapper = new MexcDataMapper();
      const normalizeSymbol = (mapper as any).normalizeSymbol.bind(mapper);
      expect(normalizeSymbol('btcusdt')).toBe('BTCUSDT');
      expect(normalizeSymbol('ETHusdt')).toBe('ETHUSDT');
      expect(normalizeSymbol('ADAUSDT')).toBe('ADAUSDT');
    });
    it('should handle empty symbol', () => {
      const mapper = new MexcDataMapper();
      const normalizeSymbol = (mapper as any).normalizeSymbol.bind(mapper);
      expect(normalizeSymbol('')).toBe('');
    });
  });

  describe('integration tests', () => {
    it('should handle complete order lifecycle mapping', () => {
      const newOrder: MexcRawOrder = {
        orderId: '1',
        symbol: 'BTCUSDT',
        type: 'LIMIT',
        side: 'BUY',
        origQty: '1.0',
        executedQty: '0',
        price: '50000.00',
        status: 'NEW',
        time: 1640995200000
      };
      const partialOrder: MexcRawOrder = {
        ...newOrder,
        executedQty: '0.5',
        status: 'PARTIALLY_FILLED',
        updateTime: 1640995300000
      };
      const filledOrder: MexcRawOrder = {
        ...newOrder,
        executedQty: '1.0',
        status: 'FILLED',
        updateTime: 1640995400000
      };
      const newResult = mapper.mapOrder(newOrder);
      const partialResult = mapper.mapOrder(partialOrder);
      const filledResult = mapper.mapOrder(filledOrder);
      expect(newResult.status).toBe('open');
      expect(newResult.filled).toBe(0);
      expect(newResult.remaining).toBe(1.0);
      expect(partialResult.status).toBe('open');
      expect(partialResult.filled).toBe(0.5);
      expect(partialResult.remaining).toBe(0.5);
      expect(filledResult.status).toBe('filled');
      expect(filledResult.filled).toBe(1.0);
      expect(filledResult.remaining).toBe(0);
    });

    it('should handle edge cases with malformed data', () => {
      const malformedOrder: MexcRawOrder = {
        symbol: '',
        type: 'LIMIT',
        side: 'BUY', 
        status: 'NEW',
        origQty: 'invalid',
        executedQty: null as any,
        price: undefined as any
      };
      const result = mapper.mapOrder(malformedOrder);
      expect(result.symbol).toBe('');
      expect(result.amount).toBe(0);
      expect(result.filled).toBe(0);
      expect(result.price).toBeUndefined();
      expect(result.status).toBe('open');
    });
  });
});