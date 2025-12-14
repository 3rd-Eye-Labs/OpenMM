import { MexcUtils } from '../../../../exchanges/mexc/mexc-utils';
import { MexcDataMapper } from '../../../../exchanges/mexc/mexc-data-mapper';
import { toStandardFormat, toExchangeFormat } from '../../../../utils/symbol-utils';

describe('MexcUtils', () => {
  describe('Symbol conversion utility functions', () => {

    describe('toStandardFormat', () => {
      it('should format MEXC symbols to OpenMM format', () => {
        expect(toStandardFormat('BTCUSDT')).toBe('BTC/USDT');
        expect(toStandardFormat('ETHUSDT')).toBe('ETH/USDT');
        expect(toStandardFormat('INDYUSDT')).toBe('INDY/USDT');
        expect(toStandardFormat('DOGEUSDT')).toBe('DOGE/USDT');
      });

      it('should handle other quote currencies', () => {
        expect(toStandardFormat('BTCETH')).toBe('BTC/ETH');
        expect(toStandardFormat('ETHBTC')).toBe('ETH/BTC');
        expect(toStandardFormat('INDYBNB')).toBe('INDY/BNB');
      });

      it('should handle edge cases', () => {
        expect(() => toStandardFormat('')).toThrow();
        expect(() => toStandardFormat('BTC')).toThrow();
        expect(() => toStandardFormat('USDT')).toThrow();
      });

      it('should handle already formatted symbols correctly', () => {
        expect(toStandardFormat('BTC/USDT')).toBe('BTC/USDT');
      });
    });

    describe('toExchangeFormat', () => {
      it('should convert OpenMM symbols to MEXC format', () => {
        expect(toExchangeFormat('BTC/USDT')).toBe('BTCUSDT');
        expect(toExchangeFormat('ETH/USDT')).toBe('ETHUSDT');
        expect(toExchangeFormat('INDY/USDT')).toBe('INDYUSDT');
      });

      it('should handle symbols without slash', () => {
        expect(toExchangeFormat('BTCUSDT')).toBe('BTCUSDT');
      });
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

  describe('mapToOrderStatus', () => {
    it('should map cancelled statuses', () => {
      expect(MexcDataMapper.mapToOrderStatus('CANCELLED')).toBe('cancelled');
      expect(MexcDataMapper.mapToOrderStatus('CANCELED')).toBe('cancelled');
      expect(MexcDataMapper.mapToOrderStatus('cancel')).toBe('cancelled');
    });

    it('should map filled statuses', () => {
      expect(MexcDataMapper.mapToOrderStatus('FILLED')).toBe('filled');
      expect(MexcDataMapper.mapToOrderStatus('filled')).toBe('filled');
      expect(MexcDataMapper.mapToOrderStatus('EXECUTED')).toBe('filled');
      expect(MexcDataMapper.mapToOrderStatus('EXEC')).toBe('filled');
    });

    it('should map open/new statuses', () => {
      expect(MexcDataMapper.mapToOrderStatus('NEW')).toBe('open');
      expect(MexcDataMapper.mapToOrderStatus('new')).toBe('open');
      expect(MexcDataMapper.mapToOrderStatus('PARTIALLY_FILLED')).toBe('open');
      expect(MexcDataMapper.mapToOrderStatus('PARTIAL')).toBe('open');
    });

    it('should map rejected statuses', () => {
      expect(MexcDataMapper.mapToOrderStatus('REJECTED')).toBe('rejected');
      expect(MexcDataMapper.mapToOrderStatus('EXPIRED')).toBe('rejected');
    });

    it('should default to open for unknown patterns', () => {
      expect(MexcDataMapper.mapToOrderStatus('unknown message')).toBe('open');
      expect(MexcDataMapper.mapToOrderStatus('')).toBe('open');
    });
  });

  describe('Transform UserData Order', () => {
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
      const result = MexcUtils.transformOrder(protobufOrder);
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
        s: 2, 
        S: 1, 
        v: '1.5', 
        p: '50000.00', 
        z: '1.5' 
      };
      const result = MexcUtils.transformOrder(mexcOrderData);
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
        s: 1, 
        S: 2, 
        v: '2.0',
        p: '3000.00',
        z: '0'
      };
      const result = MexcUtils.transformOrder(mexcOrderData);
      expect(result.side).toBe('sell');
      expect(result.status).toBe('open');
      expect(result.filled).toBe(0);
      expect(result.remaining).toBe(2.0);
    });
    it('should handle cancelled orders', () => {
      const mexcOrderData = {
        i: 12347,
        c: 'ADAUSDT',
        s: 4, 
        S: 1,
        v: '100.0',
        p: '1.50',
        z: '0'
      };
      const result = MexcUtils.transformOrder(mexcOrderData);
      expect(result.status).toBe('cancelled');
    });
    it('should handle partially filled then cancelled orders', () => {
      const mexcOrderData = {
        i: 12348,
        c: 'DOGEUSDT',
        s: 5, 
        S: 1,
        v: '1000.0',
        p: '0.10',
        z: '500.0'
      };
      const result = MexcUtils.transformOrder(mexcOrderData);
      expect(result.status).toBe('cancelled');
      expect(result.filled).toBe(500.0);
      expect(result.remaining).toBe(500.0);
    });
    it('should handle unknown status codes', () => {
      const mexcOrderData = {
        i: 12349,
        c: 'SOLUSDT',
        s: 999, 
        S: 1,
        v: '10.0',
        p: '100.00',
        z: '0'
      };
      const result = MexcUtils.transformOrder(mexcOrderData);
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
      const result = MexcUtils.transformOrder(mexcOrderData);
      const afterTime = Date.now();
      const resultId = parseInt(result.id);
      expect(resultId).toBeGreaterThanOrEqual(beforeTime);
      expect(resultId).toBeLessThanOrEqual(afterTime);
    });
    it('should handle missing fields gracefully', () => {
      const mexcOrderData = {
        i: 12350
      };
      const result = MexcUtils.transformOrder(mexcOrderData);
      expect(result.id).toBe('12350');
      expect(result.symbol).toBe('');
      expect(result.side).toBe('buy');
      expect(result.amount).toBe(0);
      expect(result.price).toBe(0);
      expect(result.filled).toBe(0);
      expect(result.remaining).toBe(0);
      expect(result.status).toBe('open');
    });
  });
  describe('edge cases and error handling', () => {
    it('should handle toStandardFormat with special cases', () => {
      expect(toStandardFormat('USDCUSDT')).toBe('USDC/USDT');
      expect(toStandardFormat('BUSDUSDT')).toBe('BUSD/USDT');
      expect(toStandardFormat('WBTCBTC')).toBe('WBTC/BTC');
      expect(toStandardFormat('ETHBUSD')).toBe('ETH/BUSD');
    });
    it('should handle toStandardFormat with very short symbols', () => {
      expect(() => toStandardFormat('')).toThrow();
      expect(() => toStandardFormat('A')).toThrow();
      expect(() => toStandardFormat('AB')).toThrow();
      expect(() => toStandardFormat('ABC')).toThrow();
      expect(() => toStandardFormat('ABCD')).toThrow();
      expect(() => toStandardFormat('ABCDE')).toThrow();
    });
    it('should handle createOrderParams with edge cases', () => {
      const marketParams = MexcUtils.createOrderParams('BTC/USDT', 'market', 'buy', 1.0);
      expect(marketParams.price).toBeUndefined();
      expect(marketParams.timeInForce).toBeUndefined();
      const limitParams = MexcUtils.createOrderParams('BTC/USDT', 'limit', 'sell', 1.0, 0);
      expect(limitParams.price).toBeUndefined();
      expect(limitParams.timeInForce).toBeUndefined();
    });

    describe('Error cases tests', () => {
      it('should throw error when transformOrder receives null/undefined data', () => {
        expect(() => MexcUtils.transformOrder(null)).toThrow('Order data is required');
        expect(() => MexcUtils.transformOrder(undefined)).toThrow('Order data is required');
      });
      it('should handle unknown order formats in transformOrder', () => {
        const unknownOrderData = { unknownFormat: true, symbol: 'BTCUSDT' };
        const result = MexcUtils.transformOrder(unknownOrderData);
        expect(result).toBeDefined();
        expect(result.symbol).toBe('BTCUSDT');
      });

      it('should handle toStandardFormat error in transformUserDataOrderInternal', () => {
        jest.mock('../../../../utils/symbol-utils', () => ({
          toStandardFormat: jest.fn().mockImplementation((symbol) => {
            if (symbol === 'INVALIDSYMBOL') throw new Error('Invalid symbol format');
            return symbol + '/USDT';
          })
        }));
        const userDataOrder = { c: 'INVALIDSYMBOL', i: 123, S: 1 };
        const result = (MexcUtils as any).transformUserDataOrderInternal(userDataOrder);
        expect(result.symbol).toBe('INVALIDSYMBOL');
      });

      it('should handle toStandardFormat error in transformWebSocketUserOrderInternal', () => {
        jest.mock('../../../../utils/symbol-utils', () => ({
          toStandardFormat: jest.fn().mockImplementation((symbol) => {
            if (symbol === 'BADSYMBOL') throw new Error('Bad symbol');
            return symbol + '/USDT';
          })
        }));
        const wsOrder = { s: 'BADSYMBOL', i: 456 };
        const result = (MexcUtils as any).transformWebSocketUserOrderInternal(wsOrder);
        expect(result.symbol).toBe('BADSYMBOL');
      });

      it('should handle protobuf order with partial filled status', () => {
        const mockDecodedOrder = {
          quantity: 10,
          price: 50000,
          side: 'buy',
          symbol: 'BTCUSDT',
          status: 'partial-filled'
        };
        jest.spyOn(MexcDataMapper, 'mapToOrderStatus').mockReturnValue('open');
        const result = (MexcUtils as any).transformProtobufOrderInternal(mockDecodedOrder);
        expect(result.filled).toBe(10);
        expect(result.remaining).toBe(0);
      });

      it('should handle protobuf order with filled status in lowercase', () => {
        const mockDecodedOrder = {
          quantity: 5,
          price: 50000,
          side: 'sell',
          symbol: 'ETHUSDT',
          status: 'filled'
        };
        jest.spyOn(MexcDataMapper, 'mapToOrderStatus').mockReturnValue('open');
        const result = (MexcUtils as any).transformProtobufOrderInternal(mockDecodedOrder);
        expect(result.filled).toBe(5);
        expect(result.remaining).toBe(0);
      });
    });
  });
});