import { MexcProtobufDecoder } from '../../../../exchanges/mexc/mexc-protobuf-decoder';
import { MexcUtils } from '../../../../exchanges/mexc/mexc-utils';
import { MexcDataMapper } from '../../../../exchanges/mexc/mexc-data-mapper';
import { DecodedMexcOrder, DecodedMexcTickerData, DecodedMexcTradesData } from '../../../../types';
jest.mock('../../../../exchanges/mexc/mexc-utils');
jest.mock('../../../../exchanges/mexc/mexc-data-mapper');
const MockedMexcUtils = MexcUtils as jest.Mocked<typeof MexcUtils>;
const MockedMexcDataMapper = MexcDataMapper as jest.Mocked<typeof MexcDataMapper>;

describe('MexcProtobufDecoder', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    MockedMexcUtils.determineSide.mockReturnValue('buy');
    MockedMexcDataMapper.mapToOrderStatus.mockReturnValue('filled');
  });

  describe('decode()', () => {
    it('should identify and route order messages to decodeOrderMessage', () => {
      const orderMessage = 'spot@private.orders.v3.api.pbBTCUSDTC02__123456*50000.0"1.5';
      MockedMexcUtils.determineSide.mockReturnValue('buy');
      const result = MexcProtobufDecoder.decode(orderMessage);
      expect(result.type).toBe('order');
      expect(result.decoded).toBeDefined();
      expect(MockedMexcUtils.determineSide).toHaveBeenCalled();
    });

    it('should identify and route ticker messages to decodeTickerMessage', () => {
      const tickerMessage = 'spot@public.aggre.bookTicker.v3.api.pb@100ms@BTCUSDT1.234.56';
      const result = MexcProtobufDecoder.decode(tickerMessage);
      expect(result.type).toBe('ticker');
      expect(result.decoded).toBeDefined();
    });

    it('should identify and route batch ticker messages to decodeTickerMessage', () => {
      const batchTickerMessage = 'spot@public.bookTicker.batch.v3.api.pbBTCUSDT1.234.56';
      const result = MexcProtobufDecoder.decode(batchTickerMessage);
      expect(result.type).toBe('ticker');
      expect(result.decoded).toBeDefined();
    });

    it('should identify and route trades messages to decodeTradesMessage', () => {
      const tradesMessage = 'spot@public.aggre.deals.v3.api.pb@100ms@BTCUSDT1.234.56';
      const result = MexcProtobufDecoder.decode(tradesMessage);
      expect(result.type).toBe('trades');
      expect(result.decoded).toBeDefined();
    });

    it('should handle unknown message types', () => {
      const unknownMessage = 'spot@public.unknown.message.type@BTCUSDT';
      const result = MexcProtobufDecoder.decode(unknownMessage);
      expect(result.type).toBe('unknown');
      expect(result.error).toContain('Unsupported message type');
      expect(result.raw).toBe(unknownMessage);
    });

    it('should handle messages without channel match', () => {
      const invalidMessage = 'invalid_message_format';
      const result = MexcProtobufDecoder.decode(invalidMessage);
      expect(result.type).toBe('unknown');
      expect(result.channel).toBe('unknown');
      expect(result.error).toContain('Unsupported message type');
    });

    it('should handle decoding errors gracefully', () => {
      MockedMexcUtils.determineSide.mockImplementation(() => {
        throw new Error('Test error');
      });
      const orderMessage = 'spot@private.orders.v3.api.pbBTCUSDT';
      const result = MexcProtobufDecoder.decode(orderMessage);
      expect(result.type).toBe('order');
      expect(result.error).toContain('Order decode error: Test error');
    });

    it('should handle non-Error exceptions', () => {
      MockedMexcUtils.determineSide.mockImplementation(() => {
        throw 'String error';
      });
      const orderMessage = 'spot@private.orders.v3.api.pbBTCUSDT';
      const result = MexcProtobufDecoder.decode(orderMessage);
      expect(result.type).toBe('order');
      expect(result.error).toContain('Order decode error: Unknown error');
    });

    it('should extract correct channel from messages', () => {
      const messages = [
        { msg: 'spot@private.orders.v3.api.pbBTCUSDT', expected: 'spot@private.orders.v3.api.pbBTCUSDT' },
        { msg: 'spot@public.aggre.bookTicker.v3.api.pb@100ms@BTCUSDT', expected: 'spot@public.aggre.bookTicker.v3.api.pb' },
        { msg: 'spot@public.aggre.deals.v3.api.pb@100ms@BTCUSDT', expected: 'spot@public.aggre.deals.v3.api.pb' }
      ];
      messages.forEach(({ msg, expected }) => {
        const result = MexcProtobufDecoder.decode(msg);
        expect(result.channel).toBe(expected);
      });
    });
  });
  describe('decodeOrderMessage()', () => {
    it('should extract order ID from C02__ pattern', () => {
      const message = 'spot@private.orders.v3.api.pbBTCUSDTC02__987654*45000.0"2.0';
      MockedMexcUtils.determineSide.mockReturnValue('sell');
      const result = MexcProtobufDecoder.decode(message);
      const decoded = result.decoded as DecodedMexcOrder;
      expect(decoded.orderId).toBe('C02__987654');
      expect(decoded.side).toBe('sell');
    });

    it('should handle missing order ID gracefully', () => {
      const message = 'spot@private.orders.v3.api.pbBTCUSDT';
      const result = MexcProtobufDecoder.decode(message);
      const decoded = result.decoded as DecodedMexcOrder;
      expect(decoded.orderId).toBe('UNKNOWN');
    });

    it('should extract prices using multiple patterns', () => {
      const priceMessages = [
        { msg: 'spot@private.orders.v3.api.pbBTCUSDT*42500.75"', expectedPrice: 42500.75 },
        { msg: 'spot@private.orders.v3.api.pbBTCUSDT1.234567"', expectedPrice: 1.234567 }
      ];
      priceMessages.forEach(({ msg, expectedPrice }) => {
        const result = MexcProtobufDecoder.decode(msg);
        const decoded = result.decoded as DecodedMexcOrder;
        expect(decoded.price).toBe(expectedPrice);
      });
    });

    it('should extract quantities using multiple patterns', () => {
      const quantityMessages = [
        { msg: 'spot@private.orders.v3.api.pbBTCUSDT"3.5R', expectedQuantity: 3.5 }
      ];
      quantityMessages.forEach(({ msg, expectedQuantity }) => {
        const result = MexcProtobufDecoder.decode(msg);
        const decoded = result.decoded as DecodedMexcOrder;
        expect(decoded.quantity).toBe(expectedQuantity);
      });
    });

    it('should handle symbol extraction and formatting', () => {
      const symbolMessages = [
        { msg: 'spot@private.orders.v3.api.pbBTCUSDT', expectedSymbol: 'BTC/USDT' }
      ];
      symbolMessages.forEach(({ msg, expectedSymbol }) => {
        const result = MexcProtobufDecoder.decode(msg);
        const decoded = result.decoded as DecodedMexcOrder;
        expect(decoded.symbol).toBe(expectedSymbol);
      });
    });

    it('should include timestamp in decoded order', () => {
      const message = 'spot@private.orders.v3.api.pbBTCUSDT';
      const beforeTime = Date.now();
      const result = MexcProtobufDecoder.decode(message);
      const decoded = result.decoded as DecodedMexcOrder;
      const afterTime = Date.now();
      expect(decoded.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(decoded.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should handle order decoding errors', () => {
      MockedMexcUtils.determineSide.mockImplementation(() => {
        throw new Error('Status error');
      });
      const message = 'spot@private.orders.v3.api.pbBTCUSDT';
      const result = MexcProtobufDecoder.decode(message);
      expect(result.type).toBe('order');
      expect(result.error).toContain('Order decode error: Status error');
    });
  });
  describe('decodeTickerMessage()', () => {
    it('should extract symbol from ticker messages', () => {
      const tickerMessages = [
        'spot@public.aggre.bookTicker.v3.api.pb@100ms@ETHUSDT',
        'spot@public.bookTicker.batch.v3.api.pbBTCUSDT'
      ];
      tickerMessages.forEach(message => {
        const result = MexcProtobufDecoder.decode(message);
        expect(result.symbol).toMatch(/[A-Z]{3,}USDT|[A-Z]{3,}BTC/);
      });
    });

    it('should extract price data from ticker messages', () => {
      const message = 'spot@public.aggre.bookTicker.v3.api.pb@100ms@BTCUSDT1.1002.200';
      const result = MexcProtobufDecoder.decode(message);
      const decoded = result.decoded as DecodedMexcTickerData;
      expect(typeof decoded.bidprice).toBe('string');
      expect(typeof decoded.askprice).toBe('string');
      expect(typeof decoded.bidquantity).toBe('string');
      expect(typeof decoded.askquantity).toBe('string');
    });

    it('should handle messages with no price matches', () => {
      const message = 'spot@public.aggre.bookTicker.v3.api.pb@100ms@BTCUSDT';
      const result = MexcProtobufDecoder.decode(message);
      const decoded = result.decoded as DecodedMexcTickerData;
      expect(decoded.bidprice).toBe('0');
      expect(decoded.askprice).toBe('0');
      expect(decoded.bidquantity).toBe('0');
      expect(decoded.askquantity).toBe('0');
    });

    it('should handle missing symbol gracefully', () => {
      const message = 'spot@public.aggre.bookTicker.v3.api.pb@100ms@';
      const result = MexcProtobufDecoder.decode(message);
      expect(result.symbol).toBe('UNKNOWN');
    });

    it('should include correct metadata', () => {
      const message = 'spot@public.aggre.bookTicker.v3.api.pb@100ms@ADAUSDT';
      const result = MexcProtobufDecoder.decode(message);
      expect(result.type).toBe('ticker');
      expect(result.raw).toBe(message);
      expect(result.channel).toBe('spot@public.aggre.bookTicker.v3.api.pb');
    });
  });

  describe('decodeTradesMessage()', () => {
    it('should extract symbol from trades messages', () => {
      const message = 'spot@public.aggre.deals.v3.api.pb@100ms@DOGEUSDT';
      const result = MexcProtobufDecoder.decode(message);
      expect(result.symbol).toBe('DOGEUSDT');
    });

    it('should create deals list with price data when available', () => {
      const message = 'spot@public.aggre.deals.v3.api.pb@100ms@BTCUSDT47500.502.75';
      const result = MexcProtobufDecoder.decode(message);
      const decoded = result.decoded as DecodedMexcTradesData;
      expect(decoded.eventtype).toBe('trade');
      expect(Array.isArray(decoded.dealsList)).toBe(true);
      if (decoded.dealsList.length > 0) {
        const deal = decoded.dealsList[0];
        expect(typeof deal.price).toBe('string');
        expect(typeof deal.quantity).toBe('string');
        expect(typeof deal.time).toBe('string');
        expect(deal.tradetype).toBe(1);
      }
    });

    it('should handle messages with no price matches', () => {
      const message = 'spot@public.aggre.deals.v3.api.pb@100ms@BTCUSDT';
      const result = MexcProtobufDecoder.decode(message);
      const decoded = result.decoded as DecodedMexcTradesData;
      expect(decoded.dealsList).toHaveLength(0);
      expect(decoded.eventtype).toBe('trade');
    });

    it('should handle missing symbol gracefully', () => {
      const message = 'spot@public.aggre.deals.v3.api.pb@100ms@';
      const result = MexcProtobufDecoder.decode(message);
      expect(result.symbol).toBe('UNKNOWN');
    });

    it('should include correct metadata', () => {
      const message = 'spot@public.aggre.deals.v3.api.pb@100ms@SOLUSDT';
      const result = MexcProtobufDecoder.decode(message);
      expect(result.type).toBe('trades');
      expect(result.raw).toBe(message);
      expect(result.channel).toBe('spot@public.aggre.deals.v3.api.pb');
    });

    it('should generate timestamps for trades', () => {
      const message = 'spot@public.aggre.deals.v3.api.pb@100ms@BTCUSDT50000.001.00';
      const beforeTime = Date.now();
      const result = MexcProtobufDecoder.decode(message);
      const decoded = result.decoded as DecodedMexcTradesData;
      if (decoded.dealsList.length > 0) {
        const tradeTime = parseInt(decoded.dealsList[0].time);
        expect(tradeTime).toBeGreaterThanOrEqual(beforeTime);
      }
    });
  });

  describe('edge && error cases', () => {
    it('should handle empty messages', () => {
      const result = MexcProtobufDecoder.decode('');
      expect(result.type).toBe('unknown');
      expect(result.channel).toBe('unknown');
      expect(result.error).toContain('Unsupported message type');
    });

    it('should handle malformed messages', () => {
      const malformedMessage = 'spot@corrupted.data.v3.api.pb@corrupt';
      const result = MexcProtobufDecoder.decode(malformedMessage);
      expect(result.type).toBe('unknown');
      expect(result.error).toContain('Unsupported message type');
    });

    it('should handle very long messages without crashing', () => {
      const longMessage = 'spot@private.orders.v3.api.pb' + 'X'.repeat(10000);
      const result = MexcProtobufDecoder.decode(longMessage);
      expect(result.type).toBe('order');
      expect(result.raw).toBe(longMessage);
    });

    it('should handle different symbol formats in order messages', () => {
      const messages = [
        'spot@private.orders.v3.api.pbBTCETH',
        'spot@private.orders.v3.api.pbETHBNB',
        'spot@private.orders.v3.api.pbADAUSDT'
      ];
      messages.forEach(message => {
        const result = MexcProtobufDecoder.decode(message);
        expect(result.type).toBe('order');
        expect(result.decoded).toBeDefined();
      });
    });

    it('should preserve original message in raw field', () => {
      const originalMessage = 'spot@public.aggre.bookTicker.v3.api.pb@100ms@BTCUSDT1.23';
      const result = MexcProtobufDecoder.decode(originalMessage);
      expect(result.raw).toBe(originalMessage);
    });

    it('should handle numeric edge cases gracefully', () => {
      const message = 'spot@private.orders.v3.api.pbBTCUSDT*0.00000001"999999.999999';
      const result = MexcProtobufDecoder.decode(message);
      expect(result.type).toBe('order');
      if (result.decoded) {
        const decoded = result.decoded as DecodedMexcOrder;
        expect(typeof decoded.price).toBe('number');
        expect(typeof decoded.quantity).toBe('number');
      }
    });

    it('should call MexcUtils methods for order processing', () => {
      const message = 'spot@private.orders.v3.api.pbBTCUSDT';
      MexcProtobufDecoder.decode(message);
      expect(MockedMexcUtils.determineSide).toHaveBeenCalledWith(message);
    });

    it('should handle catch block in decode when invalid message format provided', () => {
      const invalidMessage = '';
      const result = MexcProtobufDecoder.decode(invalidMessage);
      expect(result.type).toBe('unknown');
      expect(result.error).toContain('Unsupported message type');
      expect(result.raw).toBe(invalidMessage);
      expect(result.channel).toBe('unknown');
    });
    it('should handle catch block in decodeOrderMessage', () => {
      MockedMexcUtils.determineSide.mockImplementationOnce(() => {
        throw new Error('Side determination error');
      });
      const message = 'spot@private.orders.v3.api.pbBTCUSDT';
      const result = MexcProtobufDecoder['decodeOrderMessage'](message, 'spot@private.orders.v3.api.pb');
      expect(result.type).toBe('order');
      expect(result.error).toContain('Order decode error: Side determination error');
    });
  });
});