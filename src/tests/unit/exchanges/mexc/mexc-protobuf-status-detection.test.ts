import { MexcProtobufDecoder } from '../../../../exchanges/mexc/mexc-protobuf-decoder';
import { DecodedMexcOrder } from '../../../../types';

describe('MEXC Protobuf Status Detection', () => {
  describe('Order Status Priority Detection', () => {
    test('should prioritize cancelled over filled when both indicators are present', () => {
      const cancelledOrderMessage = `
spot@private.orders.v3.api.pb\u001a\bINDYUSDT0����3�\u0013]\n\u001aC02__627797424542343168060\u001a\u00060.3328"\u000528.98*\b9.6445442\u000108\u0001@\u0002R\b9.644544Z\u000528.98j\u00010r\u00010x\u0004�\u0001����3
      `.trim();

      const result = MexcProtobufDecoder.decode(cancelledOrderMessage);

      expect(result.type).toBe('order');
      expect(result.decoded).toBeDefined();
      
      if (result.decoded && result.type === 'order') {
        const orderData = result.decoded as DecodedMexcOrder;
        expect(orderData.orderId).toBe('C02__627797424542343168060');
        expect(orderData.symbol).toBe('INDY/USDT');
        
        expect(orderData.status).toBe('cancelled');
        console.log('Actual status detected:', orderData.status);
      }
    });

    test('should correctly detect genuinely filled orders', () => {
      const filledOrderMessage = `
spot@private.orders.v3.api.pb\u001a\bINDYUSDT0����3�\u0013i\n\u001aC02__627797402794909698060\u001a\u00060.3229"\u000528.98*\b3.8794242\u00060.32298\u0001@\u0002R\u00063.8794Z\u000511.41j\u00010r\u00010x\u0002�\u0001����3
      `.trim();

      const result = MexcProtobufDecoder.decode(filledOrderMessage);

      expect(result.type).toBe('order');
      expect(result.decoded).toBeDefined();
      
      if (result.decoded && result.type === 'order') {
        const orderData = result.decoded as DecodedMexcOrder;
        expect(orderData.orderId).toBe('C02__627797402794909698060');
        expect(orderData.symbol).toBe('INDY/USDT');
        expect(orderData.status).toBe('filled');
      }
    });

    test('should correctly detect open/new orders', () => {
      const newOrderMessage = `
spot@private.orders.v3.api.pb\u001a\bINDYUSDT0����3�\u0013Z\n\u001aC02__627797420385812480060\u001a\u00050.323"\u000528.98*\u00079.360542\u000108\u0001@\u0001R\u00079.36054Z\u000528.98j\u00010r\u00010x\u0001�\u0001�����3
      `.trim();

      const result = MexcProtobufDecoder.decode(newOrderMessage);

      expect(result.type).toBe('order');
      expect(result.decoded).toBeDefined();
      
      if (result.decoded && result.type === 'order') {
        const orderData = result.decoded as DecodedMexcOrder;
        expect(orderData.orderId).toBe('C02__627797420385812480060');
        expect(orderData.symbol).toBe('INDY/USDT');
        expect(orderData.status).toBe('new');
      }
    });

    test('should analyze binary field status correctly', () => {
      const mixedStatusMessage = `
spot@private.orders.v3.api.pb\u001a\bINDYUSDT0����3�\u0013]\n\u001aC02__627797334813646848060\u001a\u00060.3327"\u000528.98*\b9.6416462\u000108\u0001@\u0002R\b9.641646Z\u000528.98j\u00010r\u0001x\u0004�\u0001����3
      `.trim();

      const result = MexcProtobufDecoder.decode(mixedStatusMessage);

      expect(result.type).toBe('order');
      expect(result.decoded).toBeDefined();
      
      if (result.decoded && result.type === 'order') {
        const orderData = result.decoded as DecodedMexcOrder;
        expect(orderData.orderId).toBe('C02__627797334813646848060');
        expect(orderData.symbol).toBe('INDY/USDT');
        
        expect(orderData.status).toBe('cancelled');
      }
    });

    test('should handle protobuf field analysis priority correctly', () => {
      const testCases = [
        {
          name: 'cancelled order with field 8 status 4',
          message: 'spot@private.orders.v3.api.pbINDYUSDT\x08\x04C02__123456789',
          expectedStatus: 'cancelled'
        },
        {
          name: 'filled order with field 8 status 2',
          message: 'spot@private.orders.v3.api.pbINDYUSDT\x08\x02C02__123456789',
          expectedStatus: 'filled'
        },
        {
          name: 'new order with field 8 status 1',
          message: 'spot@private.orders.v3.api.pbINDYUSDT\x08\x01C02__123456789',
          expectedStatus: 'new'
        }
      ];

      testCases.forEach(({  message, expectedStatus }) => {
        const result = MexcProtobufDecoder.decode(message);
        
        expect(result.type).toBe('order');
        if (result.decoded && result.type === 'order') {
          const orderData = result.decoded as DecodedMexcOrder;
          expect(orderData.status).toBe(expectedStatus);
        }
      });
    });
  });

  describe('Real Message Pattern Analysis', () => {
    test('should correctly parse actual problematic messages from logs', () => {
      const problematicMessages = [
        {
          description: 'Message incorrectly detected as filled (should be cancelled)',
          raw: '\n\x1Dspot@private.orders.v3.api.pb\x1A\bINDYUSDT0����3�\x13]\n\x1AC02__627797424542343168060\x1A\x060.3328"\x0528.98*\b9.6445442\x0108\x01@\x02R\b9.644544Z\x0528.98j\x010r\x010x\x04�\x01����3',
          expectedOrderId: 'C02__627797424542343168060',
          expectedSymbol: 'INDY/USDT',
          expectedStatus: 'cancelled',
          hasFilledIndicator: true,
          hasCancelledIndicator: true
        },
        {
          description: 'Message correctly detected as filled',
          raw: '\n\x1Dspot@private.orders.v3.api.pb\x1A\bINDYUSDT0����3�\x13i\n\x1AC02__627797402794909698060\x1A\x060.3229"\x0528.98*\b3.87942\x00608\x01@\x02R\x063.8794Z\x0511.41j\x010r\x010x\x02�\x01����3',
          expectedOrderId: 'C02__627797402794909698060',
          expectedSymbol: 'INDY/USDT',
          expectedStatus: 'filled',
          hasFilledIndicator: true,
          hasCancelledIndicator: false
        }
      ];

      problematicMessages.forEach(({ description, raw, expectedOrderId, expectedSymbol, expectedStatus, hasFilledIndicator, hasCancelledIndicator }) => {
        console.log(`\nTesting: ${description}`);
        
        const result = MexcProtobufDecoder.decode(raw);
        
        let orderData: DecodedMexcOrder | null = null;
        if (result.decoded && result.type === 'order') {
          orderData = result.decoded as DecodedMexcOrder;
        }

        console.log('Debug info:', {
          extractedStatus: orderData?.status,
          expectedStatus,
          hasFilledIndicator,
          hasCancelledIndicator,
          orderId: orderData?.orderId
        });

        expect(result.type).toBe('order');
        expect(result.decoded).toBeDefined();
        
        if (orderData) {
          expect(orderData.orderId).toBe(expectedOrderId);
          expect(orderData.symbol).toBe(expectedSymbol);
          expect(orderData.status).toBe(expectedStatus);
        }
      });
    });
  });

  describe('Status Priority Logic Verification', () => {
    test('should follow correct priority: cancelled > partially_filled > filled > new', () => {
      const priorityTestCases = [
        {
          name: 'cancelled with fill indicators should be cancelled',
          hasCancelled: true,
          hasFilled: true,
          hasPartial: false,
          expected: 'cancelled'
        },
        {
          name: 'partial with fill indicators should be partially_filled',
          hasCancelled: false,
          hasFilled: true,
          hasPartial: true,
          expected: 'partially_filled'
        },
        {
          name: 'only filled indicators should be filled',
          hasCancelled: false,
          hasFilled: true,
          hasPartial: false,
          expected: 'filled'
        },
        {
          name: 'no indicators should be new',
          hasCancelled: false,
          hasFilled: false,
          hasPartial: false,
          expected: 'new'
        }
      ];

      priorityTestCases.forEach(({ name, hasCancelled, hasFilled, hasPartial, expected }) => {
        console.log(`\nTesting priority logic: ${name}`);
        
        let message = 'spot@private.orders.v3.api.pbINDYUSDTC02__123456789';
        
        if (hasCancelled) message += '\u0004';
        if (hasFilled) message += '\u0002';
        if (hasPartial) message += '\u0003';
        
        const result = MexcProtobufDecoder.decode(message);
        
        let orderData: DecodedMexcOrder | null = null;
        if (result.decoded && result.type === 'order') {
          orderData = result.decoded as DecodedMexcOrder;
        }
        
        console.log('Priority test result:', {
          hasCancelled,
          hasFilled,
          hasPartial,
          extractedStatus: orderData?.status,
          expected
        });
        
        expect(orderData?.status).toBe(expected);
      });
    });
  });
});