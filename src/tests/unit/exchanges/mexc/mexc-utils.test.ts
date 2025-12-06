import { MexcUtils } from '../../../../exchanges/mexc/mexc-utils';
import { createMockOrder } from '../../../fixtures/test-helpers';

describe('MexcUtils', () => {
  describe('formatSymbol', () => {
    it('should format MEXC symbols to OpenMM format', () => {
      expect(MexcUtils.formatSymbol('BTCUSDT')).toBe('BTC/USDT');
      expect(MexcUtils.formatSymbol('ETHUSDT')).toBe('ETH/USDT');
      expect(MexcUtils.formatSymbol('INDYUSDT')).toBe('INDY/USDT');
      expect(MexcUtils.formatSymbol('DOGEUSDT')).toBe('DOGE/USDT');
    });

    it('should handle other quote currencies', () => {
      expect(MexcUtils.formatSymbol('BTCETH')).toBe('BTC/ETH');
      expect(MexcUtils.formatSymbol('ETHBTC')).toBe('ETH/BTC');
      expect(MexcUtils.formatSymbol('INDYBNB')).toBe('INDY/BNB');
    });

    it('should handle edge cases', () => {
      expect(MexcUtils.formatSymbol('')).toBe('');
      expect(MexcUtils.formatSymbol('BTC')).toBe('BTC');
      expect(MexcUtils.formatSymbol('USDT')).toBe('USDT');
    });

    it('should handle already formatted symbols (current behavior)', () => {
      expect(MexcUtils.formatSymbol('BTC/USDT')).toBe('BTC//USDT');
    });
  });

  describe('toMexcSymbol', () => {
    it('should convert OpenMM symbols to MEXC format', () => {
      expect(MexcUtils.toMexcSymbol('BTC/USDT')).toBe('BTCUSDT');
      expect(MexcUtils.toMexcSymbol('ETH/USDT')).toBe('ETHUSDT');
      expect(MexcUtils.toMexcSymbol('INDY/USDT')).toBe('INDYUSDT');
    });

    it('should handle symbols without slash', () => {
      expect(MexcUtils.toMexcSymbol('BTCUSDT')).toBe('BTCUSDT');
    });
  });

  describe('transformProtobufOrder', () => {
    it('should transform protobuf decoded order to OpenMM format', () => {
      const decodedOrder = createMockOrder({
        orderId: 'C02__123456789',
        symbol: 'INDY/USDT',
        price: 0.12340,
        quantity: 100.00,
        side: 'buy',
        status: 'filled'
      });

      const result = MexcUtils.transformProtobufOrder(decodedOrder);

      expect(result).toEqual({
        id: 'C02__123456789',
        symbol: 'INDY/USDT',
        type: 'limit',
        side: 'buy',
        amount: 100.00,
        price: 0.12340,
        filled: 100.00,
        remaining: 0,
        status: 'filled',
        timestamp: decodedOrder.timestamp
      });
    });

    it('should handle partial fills', () => {
      const decodedOrder = createMockOrder({
        status: 'partial',
        quantity: 100.00
      });

      const result = MexcUtils.transformProtobufOrder(decodedOrder);

      expect(result.filled).toBe(100.00);
      expect(result.remaining).toBe(0);
      expect(result.status).toBe('open');
    });
  });

  describe('createOrderParams', () => {
    it('should create limit order parameters', () => {
      const result = MexcUtils.createOrderParams(
        'BTC/USDT',
        'limit',
        'buy',
        1.5,
        50000.00
      );

      expect(result).toEqual({
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: '1.5',
        price: '50000',
        timeInForce: 'GTC'
      });
    });

    it('should create market order parameters', () => {
      const result = MexcUtils.createOrderParams(
        'INDY/USDT',
        'market',
        'sell',
        100
      );

      expect(result).toEqual({
        symbol: 'INDYUSDT',
        side: 'SELL',
        type: 'MARKET',
        quantity: '100'
      });
    });
  });

  describe('determineSide', () => {
    it('should determine buy side from protobuf message', () => {
      expect(MexcUtils.determineSide('some message with R ')).toBe('buy');
      expect(MexcUtils.determineSide('some message with @R')).toBe('buy');
    });

    it('should determine sell side from protobuf message', () => {
      expect(MexcUtils.determineSide('some message with H')).toBe('sell');
      expect(MexcUtils.determineSide('some message with @H')).toBe('sell');
    });

    it('should default to buy for unknown patterns', () => {
      expect(MexcUtils.determineSide('unknown message')).toBe('buy');
    });
  });

  describe('extractOrderStatus', () => {
    it('should extract cancelled status', () => {
      expect(MexcUtils.extractOrderStatus('message with CANCEL')).toBe('cancelled');
      expect(MexcUtils.extractOrderStatus('message with cancel')).toBe('cancelled');
    });

    it('should extract filled status', () => {
      expect(MexcUtils.extractOrderStatus('message with FILLED')).toBe('filled');
      expect(MexcUtils.extractOrderStatus('message with FILL')).toBe('filled');
      expect(MexcUtils.extractOrderStatus('message with EXECUTED')).toBe('filled');
      expect(MexcUtils.extractOrderStatus('message with R2')).toBe('filled');
      expect(MexcUtils.extractOrderStatus('message with H2')).toBe('filled');
      expect(MexcUtils.extractOrderStatus('message with EXEC')).toBe('filled');
      expect(MexcUtils.extractOrderStatus('message with EXE')).toBe('filled');
    });

    it('should extract partial status', () => {
      expect(MexcUtils.extractOrderStatus('message with PARTIAL')).toBe('partially_filled');
    });

    it('should default to new for unknown patterns', () => {
      expect(MexcUtils.extractOrderStatus('unknown message')).toBe('new');
    });
  });

  describe('transformUserDataOrder', () => {
    it('should transform protobuf-like order data', () => {
      const protobufOrder = {
        orderId: 'C02__123456',
        symbol: 'BTC/USDT',
        price: 50000,
        quantity: 1.0,
        side: 'buy',
        status: 'filled',
        timestamp: Date.now()
      };

      const result = MexcUtils.transformUserDataOrder(protobufOrder);

      expect(result.id).toBe('C02__123456');
      expect(result.symbol).toBe('BTC/USDT');
      expect(result.type).toBe('limit');
      expect(result.side).toBe('buy');
      expect(result.amount).toBe(1.0);
      expect(result.price).toBe(50000);
      expect(result.status).toBe('filled');
    });

    it('should transform numeric status codes', () => {
      const mexcOrderData = {
        i: 12345,
        c: 'BTCUSDT',
        s: 2, // filled status
        S: 1, // buy side
        v: '1.5', // volume
        p: '50000.00', // price
        z: '1.5' // filled quantity
      };

      const result = MexcUtils.transformUserDataOrder(mexcOrderData);

      expect(result.id).toBe('12345');
      expect(result.symbol).toBe('BTC/USDT');
      expect(result.side).toBe('buy');
      expect(result.amount).toBe(1.5);
      expect(result.price).toBe(50000.00);
      expect(result.filled).toBe(1.5);
      expect(result.remaining).toBe(0);
      expect(result.status).toBe('filled');
    });

    it('should handle sell side correctly', () => {
      const mexcOrderData = {
        i: 12346,
        c: 'ETHUSDT',
        s: 1, // open status
        S: 2, // sell side (not 1)
        v: '2.0',
        p: '3000.00',
        z: '0'
      };

      const result = MexcUtils.transformUserDataOrder(mexcOrderData);

      expect(result.side).toBe('sell');
      expect(result.status).toBe('open');
      expect(result.filled).toBe(0);
      expect(result.remaining).toBe(2.0);
    });

    it('should handle cancelled orders', () => {
      const mexcOrderData = {
        i: 12347,
        c: 'ADAUSDT',
        s: 4, // cancelled status
        S: 1,
        v: '100.0',
        p: '1.50',
        z: '0'
      };

      const result = MexcUtils.transformUserDataOrder(mexcOrderData);

      expect(result.status).toBe('cancelled');
    });

    it('should handle partially filled then cancelled orders', () => {
      const mexcOrderData = {
        i: 12348,
        c: 'DOGEUSDT',
        s: 5, // partially filled then cancelled
        S: 1,
        v: '1000.0',
        p: '0.10',
        z: '500.0'
      };

      const result = MexcUtils.transformUserDataOrder(mexcOrderData);

      expect(result.status).toBe('cancelled');
      expect(result.filled).toBe(500.0);
      expect(result.remaining).toBe(500.0);
    });

    it('should handle unknown status codes', () => {
      const mexcOrderData = {
        i: 12349,
        c: 'SOLUSDT',
        s: 999, // unknown status
        S: 1,
        v: '10.0',
        p: '100.00',
        z: '0'
      };

      const result = MexcUtils.transformUserDataOrder(mexcOrderData);

      expect(result.status).toBe('open');
    });

    it('should generate fallback ID when missing', () => {
      const mexcOrderData = {
        c: 'BTCUSDT',
        s: 1,
        S: 1,
        v: '1.0',
        p: '50000.00',
        z: '0'
      };

      const beforeTime = Date.now();
      const result = MexcUtils.transformUserDataOrder(mexcOrderData);
      const afterTime = Date.now();

      const resultId = parseInt(result.id);
      expect(resultId).toBeGreaterThanOrEqual(beforeTime);
      expect(resultId).toBeLessThanOrEqual(afterTime);
    });

    it('should handle missing fields gracefully', () => {
      const mexcOrderData = {
        i: 12350
      };

      const result = MexcUtils.transformUserDataOrder(mexcOrderData);

      expect(result.id).toBe('12350');
      expect(result.symbol).toBe('');
      expect(result.side).toBe('sell');
      expect(result.amount).toBe(0);
      expect(result.price).toBe(0);
      expect(result.filled).toBe(0);
      expect(result.remaining).toBe(0);
      expect(result.status).toBe('open');
    });
  });

  describe('mapProtobufStatus (private method testing via transformProtobufOrder)', () => {
    it('should map various protobuf statuses correctly', () => {
      const testCases = [
        { status: 'new', expected: 'open' },
        { status: 'NEW', expected: 'open' },
        { status: 'filled', expected: 'filled' },
        { status: 'FILLED', expected: 'filled' },
        { status: 'partially_filled', expected: 'open' },
        { status: 'PARTIALLY_FILLED', expected: 'open' },
        { status: 'cancelled', expected: 'cancelled' },
        { status: 'canceled', expected: 'cancelled' },
        { status: 'CANCELLED', expected: 'cancelled' },
        { status: 'rejected', expected: 'rejected' },
        { status: 'REJECTED', expected: 'rejected' },
        { status: 'unknown_status', expected: 'open' }
      ];

      testCases.forEach(({ status, expected }) => {
        const decodedOrder = createMockOrder({
          status: status,
          quantity: 1.0
        });

        const result = MexcUtils.transformProtobufOrder(decodedOrder);
        expect(result.status).toBe(expected);
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle formatSymbol with special cases', () => {
      expect(MexcUtils.formatSymbol('USDCUSDT')).toBe('USDC/USDT');
      expect(MexcUtils.formatSymbol('BUSDUSDT')).toBe('BUSD/USDT');
      expect(MexcUtils.formatSymbol('WBTCBTC')).toBe('WBTC/BTC');
      expect(MexcUtils.formatSymbol('ETHBUSD')).toBe('ETH/BUSD');
    });

    it('should handle formatSymbol with very short symbols', () => {
      expect(MexcUtils.formatSymbol('')).toBe('');
      expect(MexcUtils.formatSymbol('A')).toBe('A');
      expect(MexcUtils.formatSymbol('AB')).toBe('AB');
      expect(MexcUtils.formatSymbol('ABC')).toBe('ABC');
      expect(MexcUtils.formatSymbol('ABCD')).toBe('ABCD');
      expect(MexcUtils.formatSymbol('ABCDE')).toBe('ABCDE');
    });

    it('should handle createOrderParams with edge cases', () => {
      const marketParams = MexcUtils.createOrderParams('BTC/USDT', 'market', 'buy', 1.0);
      expect(marketParams.price).toBeUndefined();
      expect(marketParams.timeInForce).toBeUndefined();

      const limitParams = MexcUtils.createOrderParams('BTC/USDT', 'limit', 'sell', 1.0, 0);
      expect(limitParams.price).toBeUndefined();
      expect(limitParams.timeInForce).toBeUndefined();
    });
  });
});