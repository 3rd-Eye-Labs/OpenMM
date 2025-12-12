import {MexcWebSocket} from '../../../../exchanges/mexc/mexc-websocket';
import {MexcProtobufDecoder} from '../../../../exchanges/mexc/mexc-protobuf-decoder';
import {MexcUtils} from '../../../../exchanges/mexc/mexc-utils';
import {createLogger} from '../../../../utils';
import {DecodedMexcMessage, Order} from '../../../../types';
import {toStandardFormat, toExchangeFormat} from '../../../../utils/symbol-utils';

jest.mock('../../../../utils/symbol-utils');
const MockedToStandardFormat = toStandardFormat as jest.MockedFunction<typeof toStandardFormat>;
const MockedToExchangeFormat = toExchangeFormat as jest.MockedFunction<typeof toExchangeFormat>;
import WebSocket from 'ws';

jest.mock('ws');
jest.mock('../../../../exchanges/mexc/mexc-protobuf-decoder');
jest.mock('../../../../exchanges/mexc/mexc-utils');
jest.mock('../../../../utils');

const MockedWebSocket = WebSocket as jest.MockedClass<typeof WebSocket>;
const MockedMexcProtobufDecoder = MexcProtobufDecoder as jest.Mocked<typeof MexcProtobufDecoder>;
const MockedMexcUtils = MexcUtils as jest.Mocked<typeof MexcUtils>;
const MockedCreateLogger = createLogger as jest.MockedFunction<typeof createLogger>;

describe('MexcWebSocket', () => {
  let mexcWebSocket: MexcWebSocket;
  let mockWs: jest.Mocked<WebSocket>;
  let mockLogger: any;

  const connectWebSocket = async (wsInstance = mexcWebSocket) => {
    const connectPromise = wsInstance.connectWebSocket();
    const openCall = mockWs.on.mock.calls.find(([event]) => event === 'open');
    if (openCall) {
      (openCall[1] as () => void)();
    }
    await connectPromise;
  };

  const setupTradesSubscription = async (symbol = 'BTC/USDT') => {
    const callback = jest.fn();
    await mexcWebSocket.subscribeTrades(symbol, callback);
    return callback;
  };

  const setupTickerSubscription = async (symbol = 'BTC/USDT') => {
    const callback = jest.fn();
    await mexcWebSocket.subscribeTicker(symbol, callback);
    return callback;
  };

  const triggerMessage = (messageContent: string, decodedMessage: DecodedMexcMessage) => {
    MockedMexcProtobufDecoder.decode.mockReturnValue(decodedMessage);
    const messageCall = mockWs.on.mock.calls.find(([event]) => event === 'message');
    if (messageCall) {
      const buffer = Buffer.from(messageContent);
      (messageCall[1] as (data: Buffer) => void)(buffer);
    }
  };

  const createMockTickerMessage = (overrides: Partial<DecodedMexcMessage> = {}): DecodedMexcMessage => ({
    type: 'ticker',
    raw: 'spot@public.aggre.bookTicker.v3.api.pb@100ms@BTCUSDT',
    channel: 'spot@public.aggre.bookTicker.v3.api.pb',
    symbol: 'BTCUSDT',
    decoded: {
      bidprice: '50000',
      askprice: '50100',
      bidquantity: '1.0',
      askquantity: '1.5'
    },
    ...overrides
  });

  const createMockTradesMessage = (overrides: Partial<DecodedMexcMessage> = {}): DecodedMexcMessage => ({
    type: 'trades',
    raw: 'spot@public.aggre.deals.v3.api.pb@100ms@BTCUSDT',
    channel: 'spot@public.aggre.deals.v3.api.pb',
    symbol: 'BTCUSDT',
    decoded: {
      dealsList: [{
        price: '50000',
        quantity: '1.0',
        time: '1640995200000',
        tradetype: 1
      }],
      eventtype: 'trade'
    },
    ...overrides
  });

  const createMockOrderMessage = (overrides: Partial<DecodedMexcMessage> = {}): DecodedMexcMessage => ({
    type: 'order',
    raw: 'spot@private.orders.v3.api.pbBTCUSDT',
    channel: 'spot@private.orders.v3.api.pb',
    symbol: 'BTCUSDT',
    decoded: {
      orderId: 'order123',
      symbol: 'BTCUSDT',
      price: 50000,
      quantity: 1.0,
      side: 'buy',
      status: 'filled',
      timestamp: Date.now(),
      channel: 'spot@private.orders.v3.api.pb'
    },
    ...overrides
  });

  const createMockOrder = (overrides: Partial<Order> = {}): Order => ({
    id: 'order123',
    symbol: 'BTC/USDT',
    type: 'limit',
    side: 'buy',
    amount: 1.0,
    price: 50000,
    filled: 1.0,
    remaining: 0,
    status: 'filled',
    timestamp: Date.now(),
    ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    MockedCreateLogger.mockReturnValue(mockLogger);

    mockWs = {
      on: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      get readyState() { return WebSocket.OPEN; }
    } as any;

    MockedWebSocket.mockImplementation(() => mockWs);

    MockedToStandardFormat.mockImplementation((symbol: string) => {
      if (symbol.includes('/')) return symbol;
      return symbol.replace(/([A-Z]+)(USDT|BTC|ETH)$/, '$1/$2');
    });
    MockedToExchangeFormat.mockImplementation((symbol: string) => symbol.replace('/', ''));

    mexcWebSocket = new MexcWebSocket();
  });

  describe('constructor', () => {
    it('should initialize with default websocket URL', () => {
      const ws = new MexcWebSocket();
      expect(ws).toBeInstanceOf(MexcWebSocket);
      expect(MockedCreateLogger).toHaveBeenCalledWith('mexc-websocket');
    });

    it('should initialize with custom websocket URL', () => {
      const customUrl = 'wss://custom.mexc.com/ws';
      const ws = new MexcWebSocket(customUrl);
      expect(ws).toBeInstanceOf(MexcWebSocket);
    });

    it('should have initial status as disconnected', () => {
      const ws = new MexcWebSocket();
      expect(ws.getWebSocketStatus()).toBe('disconnected');
      expect(ws.isConnected()).toBe(false);
    });
  });

  describe('connectWebSocket()', () => {
    it('should successfully connect to WebSocket via onOpen()', async () => {
      const connectPromise = mexcWebSocket.connectWebSocket();

      const onCall = mockWs.on.mock.calls.find(([event]) => event === 'open');
      if (onCall && onCall[1]) {
        (onCall[1] as () => void)();
      }

      await connectPromise;

      expect(MockedWebSocket).toHaveBeenCalledWith('wss://wbs-api.mexc.com/ws');
      expect(mexcWebSocket.getWebSocketStatus()).toBe('connected');
      expect(mockLogger.info).toHaveBeenCalledWith('✅ WebSocket connected successfully');
    });

    it('should handle WebSocket connection error via onError()', async () => {
      const connectPromise = mexcWebSocket.connectWebSocket();
      const error = new Error('Connection failed');

      const errorCall = mockWs.on.mock.calls.find(([event]) => event === 'error');
      if (errorCall) {
        (errorCall[1] as (error: Error) => void)(error);
      }

      await expect(connectPromise).rejects.toThrow('Connection failed');
      expect(mexcWebSocket.getWebSocketStatus()).toBe('error');
      expect(mockLogger.error).toHaveBeenCalledWith('❌ WebSocket error:', { error: 'Connection failed' });
    });

    it('should handle WebSocket close event via onClose()', async () => {
      const connectPromise = mexcWebSocket.connectWebSocket();

      const openCall = mockWs.on.mock.calls.find(([event]) => event === 'open');
      if (openCall) {
        (openCall[1] as () => void)();
      }

      await connectPromise;

      const closeCall = mockWs.on.mock.calls.find(([event]) => event === 'close');
      if (closeCall) {
        (closeCall[1] as () => void)();
      }

      expect(mexcWebSocket.getWebSocketStatus()).toBe('disconnected');
      expect(mockLogger.warn).toHaveBeenCalledWith('⚠️ WebSocket connection closed:', expect.any(Object));
    });

    it('should handle connection setup errors via onError()', async () => {
      MockedWebSocket.mockImplementation(() => {
        throw new Error('WebSocket creation failed');
      });

      await expect(mexcWebSocket.connectWebSocket()).rejects.toThrow('WebSocket creation failed');
      expect(mexcWebSocket.getWebSocketStatus()).toBe('error');
    });
  });

  describe('onMessage() - Message handler', () => {
    beforeEach(async () => {
      const connectPromise = mexcWebSocket.connectWebSocket();
      const openCall = mockWs.on.mock.calls.find(([event]) => event === 'open');
      if (openCall) {
        (openCall[1] as () => void)();
      }
      await connectPromise;
    });

    it('should process valid spot messages', () => {
      const mockDecodedMessage = createMockTickerMessage();

      MockedMexcProtobufDecoder.decode.mockReturnValue(mockDecodedMessage);

      const messageCall = mockWs.on.mock.calls.find(([event]) => event === 'message');
      if (messageCall) {
        const buffer = Buffer.from('spot@public.aggre.bookTicker.v3.api.pb@100ms@BTCUSDT');
        (messageCall[1] as (data: Buffer) => void)(buffer);
      }

      expect(MockedMexcProtobufDecoder.decode).toHaveBeenCalledWith('spot@public.aggre.bookTicker.v3.api.pb@100ms@BTCUSDT');
    });

    it('should ignore non-spot messages', () => {
      const messageCall = mockWs.on.mock.calls.find(([event]) => event === 'message');
      if (messageCall) {
        const buffer = Buffer.from('non-spot-message');
        (messageCall[1] as (data: Buffer) => void)(buffer);
      }

      expect(MockedMexcProtobufDecoder.decode).not.toHaveBeenCalled();
    });

    it('should handle messages with decode errors', () => {
      const mockDecodedMessage: DecodedMexcMessage = {
        type: 'unknown',
        raw: 'invalid-message',
        channel: 'unknown',
        error: 'Decode error occurred'
      };

      MockedMexcProtobufDecoder.decode.mockReturnValue(mockDecodedMessage);

      const messageCall = mockWs.on.mock.calls.find(([event]) => event === 'message');
      if (messageCall) {
        const buffer = Buffer.from('spot@invalid.message');
        (messageCall[1] as (data: Buffer) => void)(buffer);
      }

      expect(mockLogger.warn).toHaveBeenCalledWith('Protobuf decode error:', { error: 'Decode error occurred' });
    });

    it('should handle message processing errors', () => {
      MockedMexcProtobufDecoder.decode.mockImplementation(() => {
        throw new Error('Processing error');
      });

      const messageCall = mockWs.on.mock.calls.find(([event]) => event === 'message');
      if (messageCall) {
        const buffer = Buffer.from('spot@test.message');
        (messageCall[1] as (data: Buffer) => void)(buffer);
      }

      expect(mockLogger.error).toHaveBeenCalledWith('Message handling error:', { error: expect.any(Error) });
    });
  });

  describe('processDecodedMessage() - Process decoded message based on type', () => {
    let orderCallback: jest.Mock;
    let tickerCallback: jest.Mock;
    let tradesCallback: jest.Mock;
    let orderbookCallback: jest.Mock;

    beforeEach(async () => {
      const connectPromise = mexcWebSocket.connectWebSocket();
      const openCall = mockWs.on.mock.calls.find(([event]) => event === 'open');
      if (openCall) {
        (openCall[1] as () => void)();
      }
      await connectPromise;

      orderCallback = jest.fn();
      tickerCallback = jest.fn();
      tradesCallback = jest.fn();
      orderbookCallback = jest.fn();

      await mexcWebSocket.subscribeOrders(orderCallback);
      await mexcWebSocket.subscribeTicker('BTC/USDT', tickerCallback);
      await mexcWebSocket.subscribeTrades('BTC/USDT', tradesCallback);
      await mexcWebSocket.subscribeOrderBook('BTC/USDT', orderbookCallback);
    });

    it('should process order messages via onOrderUpdate()', () => {
      const mockOrder = createMockOrder();

      MockedMexcUtils.transformOrder.mockReturnValue(mockOrder);

      const decodedMessage = createMockOrderMessage();

      const messageCall = mockWs.on.mock.calls.find(([event]) => event === 'message');
      MockedMexcProtobufDecoder.decode.mockReturnValue(decodedMessage);

      if (messageCall) {
        const buffer = Buffer.from('spot@private.orders.v3.api.pbBTCUSDT');
        (messageCall[1] as (data: Buffer) => void)(buffer);
      }

      expect(MockedMexcUtils.transformOrder).toHaveBeenCalled();
      expect(orderCallback).toHaveBeenCalledWith(mockOrder);
    });

    it('should process ticker messages via onTickerUpdate() and onOrderBookUpdate()', () => {
      const decodedMessage = createMockTickerMessage();

      MockedMexcProtobufDecoder.decode.mockReturnValue(decodedMessage);

      const messageCall = mockWs.on.mock.calls.find(([event]) => event === 'message');
      if (messageCall) {
        const buffer = Buffer.from('spot@public.aggre.bookTicker.v3.api.pb@100ms@BTCUSDT');
        (messageCall[1] as (data: Buffer) => void)(buffer);
      }

      expect(tickerCallback).toHaveBeenCalledWith(expect.objectContaining({
        symbol: 'BTC/USDT',
        bid: 50000,
        ask: 50100,
        baseVolume: 2.5
      }));

      expect(orderbookCallback).toHaveBeenCalledWith(expect.objectContaining({
        symbol: 'BTC/USDT',
        bids: [{ price: 50000, amount: 1.0 }],
        asks: [{ price: 50100, amount: 1.5 }]
      }));
    });

    it('should process trades messages via onTradesUpdate()', () => {
      const decodedMessage = createMockTradesMessage();

      MockedMexcProtobufDecoder.decode.mockReturnValue(decodedMessage);

      const messageCall = mockWs.on.mock.calls.find(([event]) => event === 'message');
      if (messageCall) {
        const buffer = Buffer.from('spot@public.aggre.deals.v3.api.pb@100ms@BTCUSDT');
        (messageCall[1] as (data: Buffer) => void)(buffer);
      }

      expect(tradesCallback).toHaveBeenCalledWith(expect.objectContaining({
        symbol: 'BTC/USDT',
        side: 'buy',
        amount: 1.0,
        price: 50000,
        timestamp: 1640995200000
      }));
    });

    it('should handle unknown message types', () => {
      const decodedMessage: DecodedMexcMessage = {
        type: 'unknown',
        raw: 'spot@unknown.message',
        channel: 'spot@unknown.message'
      };

      MockedMexcProtobufDecoder.decode.mockReturnValue(decodedMessage);

      const messageCall = mockWs.on.mock.calls.find(([event]) => event === 'message');
      if (messageCall) {
        const buffer = Buffer.from('spot@unknown.message');
        (messageCall[1] as (data: Buffer) => void)(buffer);
      }

      expect(mockLogger.debug).toHaveBeenCalledWith('Unhandled message type: unknown');
    });

    it('should handle order processing errors in onOrderUpdate()', () => {
      MockedMexcUtils.transformOrder.mockImplementation(() => {
        throw new Error('Transform error');
      });

      const decodedMessage = createMockOrderMessage();

      MockedMexcProtobufDecoder.decode.mockReturnValue(decodedMessage);

      const messageCall = mockWs.on.mock.calls.find(([event]) => event === 'message');
      if (messageCall) {
        const buffer = Buffer.from('spot@private.orders.v3.api.pbBTCUSDT');
        (messageCall[1] as (data: Buffer) => void)(buffer);
      }

      expect(mockLogger.error).toHaveBeenCalledWith('Error handling protobuf user data message:', { error: expect.any(Error), message: expect.any(String) });
    });

    it('should handle ticker processing errors gracefully', () => {
      MockedToStandardFormat.mockImplementation(() => {
        throw new Error('Format error');
      });

      const decodedMessage = createMockTickerMessage();

      MockedMexcProtobufDecoder.decode.mockReturnValue(decodedMessage);

      const messageCall = mockWs.on.mock.calls.find(([event]) => event === 'message');
      if (messageCall) {
        const buffer = Buffer.from('spot@public.aggre.bookTicker.v3.api.pb@100ms@BTCUSDT');
        (messageCall[1] as (data: Buffer) => void)(buffer);
      }

      // Should handle symbol conversion error gracefully by using original symbol
      expect(tickerCallback).toHaveBeenCalledWith(expect.objectContaining({
        symbol: 'BTCUSDT', // Falls back to original symbol
        bid: 50000,
        ask: 50100
      }));
    });

    it('should handle trades processing errors gracefully', () => {
      MockedToStandardFormat.mockImplementation(() => {
        throw new Error('Format error');
      });

      const decodedMessage = createMockTradesMessage();

      MockedMexcProtobufDecoder.decode.mockReturnValue(decodedMessage);

      const messageCall = mockWs.on.mock.calls.find(([event]) => event === 'message');
      if (messageCall) {
        const buffer = Buffer.from('spot@public.aggre.deals.v3.api.pb@100ms@BTCUSDT');
        (messageCall[1] as (data: Buffer) => void)(buffer);
      }

      // Should handle symbol conversion error gracefully by using original symbol
      expect(tradesCallback).toHaveBeenCalledWith(expect.objectContaining({
        symbol: 'BTCUSDT', // Falls back to original symbol
        side: 'buy',
        amount: 1.0,
        price: 50000
      }));
    });

    it('should skip processing messages without required data in onOrderUpdate(), onTickerUpdate(), onTradesUpdate()', () => {
      const decodedMessages = [
        { type: 'order', raw: 'test', channel: 'test' },
        { type: 'ticker', raw: 'test', channel: 'test', decoded: {} },
        { type: 'trades', raw: 'test', channel: 'test', symbol: 'BTCUSDT' }
      ];

      decodedMessages.forEach((decodedMessage) => {
        MockedMexcProtobufDecoder.decode.mockReturnValue(decodedMessage as DecodedMexcMessage);

        const messageCall = mockWs.on.mock.calls.find(([event]) => event === 'message');
        if (messageCall) {
          const buffer = Buffer.from('spot@test.message');
          (messageCall[1] as (data: Buffer) => void)(buffer);
        }
      });

      expect(orderCallback).not.toHaveBeenCalled();
      expect(tickerCallback).not.toHaveBeenCalled();
      expect(tradesCallback).not.toHaveBeenCalled();
    });
  });

  describe('subscription methods - subscribeTicker(), subscribeTrades(), subscribeOrderBook(), subscribeOrders()', () => {
    beforeEach(async () => {
      const connectPromise = mexcWebSocket.connectWebSocket();
      const openCall = mockWs.on.mock.calls.find(([event]) => event === 'open');
      if (openCall) {
        (openCall[1] as () => void)();
      }
      await connectPromise;
    });

    it('should subscribe to ticker updates', async () => {
      const callback = jest.fn();

      const subscriptionId = await mexcWebSocket.subscribeTicker('BTC/USDT', callback);

      expect(subscriptionId).toMatch(/^ticker_BTCUSDT_\d+$/);
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({
        method: 'SUBSCRIPTION',
        params: ['spot@public.aggre.bookTicker.v3.api.pb@100ms@BTCUSDT']
      }));
      expect(mockLogger.info).toHaveBeenCalledWith('Subscribed to ticker: BTC/USDT (spot@public.aggre.bookTicker.v3.api.pb@100ms@BTCUSDT)');
    });

    it('should subscribe to trades updates', async () => {
      const callback = jest.fn();

      const subscriptionId = await mexcWebSocket.subscribeTrades('BTC/USDT', callback);

      expect(subscriptionId).toMatch(/^trades_BTCUSDT_\d+$/);
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({
        method: 'SUBSCRIPTION',
        params: ['spot@public.aggre.deals.v3.api.pb@100ms@BTCUSDT']
      }));
      expect(mockLogger.info).toHaveBeenCalledWith('Subscribed to trades: BTC/USDT (spot@public.aggre.deals.v3.api.pb@100ms@BTCUSDT)');
    });

    it('should subscribe to orderbook updates', async () => {
      const callback = jest.fn();

      const subscriptionId = await mexcWebSocket.subscribeOrderBook('BTC/USDT', callback);

      expect(subscriptionId).toMatch(/^orderbook_BTCUSDT_\d+$/);
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({
        method: 'SUBSCRIPTION',
        params: ['spot@public.bookTicker.batch.v3.api.pb@BTCUSDT']
      }));
      expect(mockLogger.info).toHaveBeenCalledWith('Subscribed to orderbook: BTC/USDT (spot@public.bookTicker.batch.v3.api.pb@BTCUSDT)');
    });

    it('should subscribe to user orders', async () => {
      const callback = jest.fn();

      const subscriptionId = await mexcWebSocket.subscribeOrders(callback);

      expect(subscriptionId).toMatch(/^orders_\d+$/);
      expect(mockLogger.info).toHaveBeenCalledWith('Subscribed to user orders (orders stream)');
    });

    it('should subscribe to user data', async () => {
      const callback = jest.fn();

      const subscriptionId = await mexcWebSocket.subscribeToUserData(callback);

      expect(subscriptionId).toMatch(/^user_data_\d+$/);
    });

    it('should throw error when subscribing without connection', async () => {
      await mexcWebSocket.disconnectWebSocket();

      const callback = jest.fn();
      
      await expect(mexcWebSocket.subscribeTicker('BTC/USDT', callback)).rejects.toThrow('WebSocket not connected');
      await expect(mexcWebSocket.subscribeTrades('BTC/USDT', callback)).rejects.toThrow('WebSocket not connected');
      await expect(mexcWebSocket.subscribeOrderBook('BTC/USDT', callback)).rejects.toThrow('WebSocket not connected');
    });
  });

  describe('unsubscribe() - Unsubscribe from subscription', () => {
    it('should unsubscribe from existing subscription', async () => {
      const connectPromise = mexcWebSocket.connectWebSocket();
      const openCall = mockWs.on.mock.calls.find(([event]) => event === 'open');
      if (openCall) {
        (openCall[1] as () => void)();
      }
      await connectPromise;

      const callback = jest.fn();
      const subscriptionId = await mexcWebSocket.subscribeTicker('BTC/USDT', callback);

      await mexcWebSocket.unsubscribe(subscriptionId);

      expect(mockLogger.info).toHaveBeenCalledWith(`Unsubscribed: ${subscriptionId}`);
    });

    it('should warn when unsubscribing non-existent subscription', async () => {
      await mexcWebSocket.unsubscribe('non-existent-id');

      expect(mockLogger.warn).toHaveBeenCalledWith('Subscription non-existent-id not found');
    });
  });

  describe('disconnectWebSocket() - Disconnect and cleanup', () => {
    it('should disconnect and cleanup', async () => {
      const connectPromise = mexcWebSocket.connectWebSocket();
      const openCall = mockWs.on.mock.calls.find(([event]) => event === 'open');
      if (openCall) {
        (openCall[1] as () => void)();
      }
      await connectPromise;

      await mexcWebSocket.subscribeTicker('BTC/USDT', jest.fn());

      await mexcWebSocket.disconnectWebSocket();

      expect(mockWs.close).toHaveBeenCalled();
      expect(mexcWebSocket.getWebSocketStatus()).toBe('disconnected');
      expect(mexcWebSocket.isConnected()).toBe(false);
    });

    it('should handle disconnect when not connected', async () => {
      await mexcWebSocket.disconnectWebSocket();

      expect(mockWs.close).not.toHaveBeenCalled();
      expect(mexcWebSocket.getWebSocketStatus()).toBe('disconnected');
    });
  });

  describe('status methods - isConnected(), getWebSocketStatus()', () => {
    it('should return correct connection status', () => {
      expect(mexcWebSocket.getWebSocketStatus()).toBe('disconnected');
      expect(mexcWebSocket.isConnected()).toBe(false);
    });

    it('should return true when connected', async () => {
      const connectPromise = mexcWebSocket.connectWebSocket();
      const openCall = mockWs.on.mock.calls.find(([event]) => event === 'open');
      if (openCall) {
        (openCall[1] as () => void)();
      }
      await connectPromise;

      expect(mexcWebSocket.getWebSocketStatus()).toBe('connected');
      expect(mexcWebSocket.isConnected()).toBe(true);
    });

    it('should return false when WebSocket readyState is not OPEN', async () => {
      const connectPromise = mexcWebSocket.connectWebSocket();
      const openCall = mockWs.on.mock.calls.find(([event]) => event === 'open');
      if (openCall) {
        (openCall[1] as () => void)();
      }
      await connectPromise;

      (mexcWebSocket as any).ws = {
        ...mockWs,
        get readyState() {
          return WebSocket.CLOSED;
        }
      };

      expect(mexcWebSocket.isConnected()).toBe(false);
    });
  });

  describe('edge cases - onTradesUpdate(), onTickerUpdate()', () => {
    it('should handle trades with empty dealsList in onTradesUpdate()', async () => {
      await connectWebSocket();
      const callback = await setupTradesSubscription();

      const decodedMessage = createMockTradesMessage({ 
        decoded: {
          dealsList: [],
          eventtype: 'trade'
        }
      });

      triggerMessage('spot@public.aggre.deals.v3.api.pb@100ms@BTCUSDT', decodedMessage);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle trades with null dealsList in onTradesUpdate()', async () => {
      await connectWebSocket();
      const callback = await setupTradesSubscription();

      const decodedMessage = createMockTradesMessage({ 
        decoded: {
          dealsList: null as any,
          eventtype: 'trade'
        }
      });

      triggerMessage('spot@public.aggre.deals.v3.api.pb@100ms@BTCUSDT', decodedMessage);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle ticker data with zero values in onTickerUpdate()', async () => {
      await connectWebSocket();
      const callback = await setupTickerSubscription();

      const decodedMessage = createMockTickerMessage({ 
        decoded: {
          bidprice: '0',
          askprice: '0',
          bidquantity: '0',
          askquantity: '0'
        }
      });

      triggerMessage('spot@public.aggre.bookTicker.v3.api.pb@100ms@BTCUSDT', decodedMessage);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        symbol: 'BTC/USDT',
        bid: 0,
        ask: 0,
        baseVolume: 0
      }));
    });
  });
});