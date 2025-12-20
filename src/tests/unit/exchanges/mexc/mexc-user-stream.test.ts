import { MexcUserStream } from '../../../../exchanges/mexc/mexc-user-stream';
import { MexcWebSocket } from '../../../../exchanges/mexc/mexc-websocket';
import { createLogger } from '../../../../utils';

jest.mock('../../../../exchanges/mexc/mexc-websocket');
jest.mock('../../../../utils');

const MockedMexcWebSocket = MexcWebSocket as jest.MockedClass<typeof MexcWebSocket>;
const MockedCreateLogger = createLogger as jest.MockedFunction<typeof createLogger>;

describe('MexcUserStream', () => {
  let mexcUserStream: MexcUserStream;
  let mockMakeRequestFn: jest.Mock;
  let mockWebSocket: jest.Mocked<MexcWebSocket>;
  let mockLogger: any;

  const setupUserStream = async () => {
    const mockResponse = { listenKey: 'test_listen_key_123' };
    mockMakeRequestFn.mockResolvedValue(mockResponse);
    await mexcUserStream.connectUserDataStream();
  };

  const setupTradeSubscription = async () => {
    const callback = jest.fn();
    await mexcUserStream.subscribeUserTrades(callback);
    const wrappedCallback = mockWebSocket.subscribeToUserData.mock.calls[0][0];
    return { callback, wrappedCallback };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    MockedCreateLogger.mockReturnValue(mockLogger);

    mockWebSocket = {
      connectWebSocket: jest.fn().mockResolvedValue(undefined),
      disconnectWebSocket: jest.fn().mockResolvedValue(undefined),
      subscribeToUserData: jest.fn().mockResolvedValue('subscription_id_123'),
      isConnected: jest.fn().mockReturnValue(true),
    } as any;

    MockedMexcWebSocket.mockImplementation(() => mockWebSocket);

    mockMakeRequestFn = jest.fn();
    mexcUserStream = new MexcUserStream(mockMakeRequestFn);
  });

  describe('constructor', () => {
    it('should initialize with makeRequestFn', () => {
      expect(mexcUserStream).toBeInstanceOf(MexcUserStream);
      expect(MockedCreateLogger).toHaveBeenCalledWith('mexc-user-stream');
    });
  });

  describe('getListenKey()', () => {
    it('should successfully get listen key', async () => {
      const mockResponse = { listenKey: 'test_listen_key_123' };
      mockMakeRequestFn.mockResolvedValue(mockResponse);

      const listenKey = await mexcUserStream.getListenKey();

      expect(mockMakeRequestFn).toHaveBeenCalledWith('/userDataStream', {}, 'POST');
      expect(listenKey).toBe('test_listen_key_123');
    });

    it('should throw error when no listen key in response', async () => {
      mockMakeRequestFn.mockResolvedValue({});

      await expect(mexcUserStream.getListenKey()).rejects.toThrow(
        'No listen key received from API'
      );
    });

    it('should handle API request errors', async () => {
      const error = new Error('API request failed');
      mockMakeRequestFn.mockRejectedValue(error);

      await expect(mexcUserStream.getListenKey()).rejects.toThrow(
        'Failed to get listen key: API request failed'
      );
    });

    it('should handle non-Error exceptions', async () => {
      mockMakeRequestFn.mockRejectedValue('String error');

      await expect(mexcUserStream.getListenKey()).rejects.toThrow(
        'Failed to get listen key: Unknown error'
      );
    });
  });

  describe('connectUserDataStream()', () => {
    it('should successfully connect user data stream', async () => {
      const mockResponse = { listenKey: 'test_listen_key_123' };
      mockMakeRequestFn.mockResolvedValue(mockResponse);

      await mexcUserStream.connectUserDataStream();

      expect(mockMakeRequestFn).toHaveBeenCalledWith('/userDataStream', {}, 'POST');
      expect(MockedMexcWebSocket).toHaveBeenCalledWith(
        'wss://wbs-api.mexc.com/ws?listenKey=test_listen_key_123'
      );
      expect(mockWebSocket.connectWebSocket).toHaveBeenCalled();
    });

    it('should reuse existing WebSocket if available', async () => {
      const mockResponse = { listenKey: 'test_listen_key_123' };
      mockMakeRequestFn.mockResolvedValue(mockResponse);

      await mexcUserStream.connectUserDataStream();
      expect(MockedMexcWebSocket).toHaveBeenCalledTimes(1);

      await mexcUserStream.connectUserDataStream();
      expect(MockedMexcWebSocket).toHaveBeenCalledTimes(1);
      expect(mockWebSocket.connectWebSocket).toHaveBeenCalledTimes(2);
    });

    it('should setup keep alive interval', async () => {
      jest.useFakeTimers();
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      const mockResponse = { listenKey: 'test_listen_key_123' };
      mockMakeRequestFn.mockResolvedValue(mockResponse);

      await mexcUserStream.connectUserDataStream();

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30 * 60 * 1000);

      setIntervalSpy.mockRestore();
      jest.useRealTimers();
    });

    it('should handle keep alive errors', async () => {
      const mockResponse = { listenKey: 'test_listen_key_123' };
      mockMakeRequestFn.mockResolvedValue(mockResponse);

      await mexcUserStream.connectUserDataStream();

      mockMakeRequestFn.mockRejectedValueOnce(new Error('Keep alive failed'));

      await mexcUserStream.keepAliveListenKey();

      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to keep alive listen key', {
        error: expect.any(Error),
      });
    });

    it('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      mockMakeRequestFn.mockRejectedValue(error);

      await expect(mexcUserStream.connectUserDataStream()).rejects.toThrow(
        'Failed to connect user data stream: Failed to get listen key: Connection failed'
      );
    });

    it('should handle non-Error exceptions', async () => {
      mockMakeRequestFn.mockRejectedValue('String error');

      await expect(mexcUserStream.connectUserDataStream()).rejects.toThrow(
        'Failed to connect user data stream: Failed to get listen key: Unknown error'
      );
    });
  });

  describe('disconnectUserDataStream()', () => {
    beforeEach(async () => {
      const mockResponse = { listenKey: 'test_listen_key_123' };
      mockMakeRequestFn.mockResolvedValue(mockResponse);
      await mexcUserStream.connectUserDataStream();
    });

    it('should successfully disconnect user data stream', async () => {
      await mexcUserStream.disconnectUserDataStream();

      expect(mockWebSocket.disconnectWebSocket).toHaveBeenCalled();
      expect(mockMakeRequestFn).toHaveBeenCalledWith(
        '/userDataStream',
        { listenKey: 'test_listen_key_123' },
        'DELETE'
      );
    });

    it('should clear keep alive interval', async () => {
      jest.useFakeTimers();
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      await mexcUserStream.disconnectUserDataStream();

      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
      jest.useRealTimers();
    });

    it('should handle disconnect errors gracefully', async () => {
      mockWebSocket.disconnectWebSocket.mockRejectedValue(new Error('Disconnect failed'));
      mockMakeRequestFn.mockRejectedValueOnce(new Error('Delete listen key failed'));

      await mexcUserStream.disconnectUserDataStream();

      expect(mockLogger.warn).toHaveBeenCalledWith('Error during user data stream disconnect', {
        error: expect.any(Error),
      });
    });

    it('should handle disconnect when not connected', async () => {
      const freshUserStream = new MexcUserStream(mockMakeRequestFn);

      await freshUserStream.disconnectUserDataStream();

      expect(mockWebSocket.disconnectWebSocket).not.toHaveBeenCalled();
    });
  });

  describe('keepAliveListenKey()', () => {
    it('should keep listen key alive when listen key exists', async () => {
      const mockResponse = { listenKey: 'test_listen_key_123' };
      mockMakeRequestFn.mockResolvedValue(mockResponse);
      await mexcUserStream.getListenKey();

      mockMakeRequestFn.mockResolvedValueOnce({});
      await mexcUserStream.keepAliveListenKey();

      expect(mockMakeRequestFn).toHaveBeenCalledWith(
        '/userDataStream',
        { listenKey: 'test_listen_key_123' },
        'PUT'
      );
    });

    it('should do nothing when no listen key', async () => {
      await mexcUserStream.keepAliveListenKey();

      expect(mockMakeRequestFn).not.toHaveBeenCalled();
    });

    it('should handle keep alive errors', async () => {
      const mockResponse = { listenKey: 'test_listen_key_123' };
      mockMakeRequestFn.mockResolvedValue(mockResponse);
      await mexcUserStream.getListenKey();

      const error = new Error('Keep alive failed');
      mockMakeRequestFn.mockRejectedValueOnce(error);

      await mexcUserStream.keepAliveListenKey();

      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to keep alive listen key', { error });
    });
  });

  describe('deleteListenKey()', () => {
    it('should delete listen key when listen key exists', async () => {
      const mockResponse = { listenKey: 'test_listen_key_123' };
      mockMakeRequestFn.mockResolvedValue(mockResponse);
      await mexcUserStream.getListenKey();

      mockMakeRequestFn.mockResolvedValueOnce({});
      await mexcUserStream.deleteListenKey();

      expect(mockMakeRequestFn).toHaveBeenCalledWith(
        '/userDataStream',
        { listenKey: 'test_listen_key_123' },
        'DELETE'
      );
    });

    it('should do nothing when no listen key', async () => {
      await mexcUserStream.deleteListenKey();

      expect(mockMakeRequestFn).not.toHaveBeenCalled();
    });

    it('should handle delete errors and clear listen key', async () => {
      const mockResponse = { listenKey: 'test_listen_key_123' };
      mockMakeRequestFn.mockResolvedValue(mockResponse);
      await mexcUserStream.getListenKey();

      const error = new Error('Delete failed');
      mockMakeRequestFn.mockRejectedValueOnce(error);

      await mexcUserStream.deleteListenKey();

      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to delete listen key', { error });
    });
  });

  describe('subscribeUserOrders()', () => {
    beforeEach(async () => {
      const mockResponse = { listenKey: 'test_listen_key_123' };
      mockMakeRequestFn.mockResolvedValue(mockResponse);
      await mexcUserStream.connectUserDataStream();
    });

    it('should successfully subscribe to user orders', async () => {
      const callback = jest.fn();

      const subscriptionId = await mexcUserStream.subscribeUserOrders(callback);

      expect(mockWebSocket.subscribeToUserData).toHaveBeenCalledWith(callback);
      expect(subscriptionId).toBe('subscription_id_123');
    });

    it('should throw error when not connected', async () => {
      const freshUserStream = new MexcUserStream(mockMakeRequestFn);
      const callback = jest.fn();

      await expect(freshUserStream.subscribeUserOrders(callback)).rejects.toThrow(
        'User data stream not connected. Call connect() first.'
      );
    });

    it('should handle subscription errors', async () => {
      const error = new Error('Subscription failed');
      mockWebSocket.subscribeToUserData.mockRejectedValue(error);
      const callback = jest.fn();

      await expect(mexcUserStream.subscribeUserOrders(callback)).rejects.toThrow(
        'Failed to subscribe to user orders: Subscription failed'
      );
    });

    it('should handle non-Error exceptions', async () => {
      mockWebSocket.subscribeToUserData.mockRejectedValue('String error');
      const callback = jest.fn();

      await expect(mexcUserStream.subscribeUserOrders(callback)).rejects.toThrow(
        'Failed to subscribe to user orders: Unknown error'
      );
    });
  });

  describe('subscribeUserTrades()', () => {
    beforeEach(async () => {
      const mockResponse = { listenKey: 'test_listen_key_123' };
      mockMakeRequestFn.mockResolvedValue(mockResponse);
      await mexcUserStream.connectUserDataStream();
    });

    it('should successfully subscribe to user trades', async () => {
      const callback = jest.fn();

      const subscriptionId = await mexcUserStream.subscribeUserTrades(callback);

      expect(mockWebSocket.subscribeToUserData).toHaveBeenCalledWith(expect.any(Function));
      expect(subscriptionId).toBe('subscription_id_123');
    });

    it('should process trade execution data', async () => {
      const callback = jest.fn();
      await mexcUserStream.subscribeUserTrades(callback);

      const wrappedCallback = mockWebSocket.subscribeToUserData.mock.calls[0][0];
      const mockTradeData = {
        id: 'order123',
        symbol: 'BTC/USDT',
        type: 'limit' as const,
        side: 'buy' as const,
        status: 'filled' as const,
        filled: 1.0,
        amount: 1.0,
        price: 50000,
        remaining: 0,
        timestamp: 1640995200000,
      };

      wrappedCallback(mockTradeData);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringContaining('order123'),
          orderId: 'order123',
          symbol: 'BTC/USDT',
          side: 'buy',
          amount: 1.0,
          price: 50000,
          timestamp: 1640995200000,
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith('✅ User data stream connected successfully');
    });

    it('should not process non-trade execution data', async () => {
      const callback = jest.fn();
      await mexcUserStream.subscribeUserTrades(callback);

      mockLogger.info.mockClear();

      const wrappedCallback = mockWebSocket.subscribeToUserData.mock.calls[0][0];
      const mockNonTradeData = {
        id: 'order123',
        symbol: 'BTC/USDT',
        type: 'limit' as const,
        side: 'buy' as const,
        status: 'open' as const,
        filled: 0,
        amount: 1.0,
        price: 50000,
        remaining: 1.0,
        timestamp: Date.now(),
      };

      (wrappedCallback as any)(mockNonTradeData);

      expect(callback).not.toHaveBeenCalled();
      // Only check that no new info logs were made after clearing
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('should throw error when not connected', async () => {
      const freshUserStream = new MexcUserStream(mockMakeRequestFn);
      const callback = jest.fn();

      await expect(freshUserStream.subscribeUserTrades(callback)).rejects.toThrow(
        'User data stream not connected. Call connect() first.'
      );
    });

    it('should handle subscription errors', async () => {
      const error = new Error('Subscription failed');
      mockWebSocket.subscribeToUserData.mockRejectedValue(error);
      const callback = jest.fn();

      await expect(mexcUserStream.subscribeUserTrades(callback)).rejects.toThrow(
        'Failed to subscribe to user trades: Subscription failed'
      );
    });

    it('should handle non-Error exceptions', async () => {
      mockWebSocket.subscribeToUserData.mockRejectedValue('String error');
      const callback = jest.fn();

      await expect(mexcUserStream.subscribeUserTrades(callback)).rejects.toThrow(
        'Failed to subscribe to user trades: Unknown error'
      );
    });
  });

  describe('isUserDataStreamConnected()', () => {
    it('should return false when not connected', () => {
      expect(mexcUserStream.isUserDataStreamConnected()).toBe(false);
    });

    it('should return true when connected', async () => {
      const mockResponse = { listenKey: 'test_listen_key_123' };
      mockMakeRequestFn.mockResolvedValue(mockResponse);
      await mexcUserStream.connectUserDataStream();

      expect(mexcUserStream.isUserDataStreamConnected()).toBe(true);
    });

    it('should return false when WebSocket is not connected', async () => {
      const mockResponse = { listenKey: 'test_listen_key_123' };
      mockMakeRequestFn.mockResolvedValue(mockResponse);
      await mexcUserStream.connectUserDataStream();

      mockWebSocket.isConnected.mockReturnValue(false);

      expect(mexcUserStream.isUserDataStreamConnected()).toBe(false);
    });

    it('should return false when WebSocket is undefined', async () => {
      const freshUserStream = new MexcUserStream(mockMakeRequestFn);

      expect(freshUserStream.isUserDataStreamConnected()).toBe(false);
    });
  });

  describe('isTradeExecution()', () => {
    it('should detect filled status as trade execution', async () => {
      await setupUserStream();
      const { callback, wrappedCallback } = await setupTradeSubscription();
      const mockData = {
        id: 'order123',
        symbol: 'BTC/USDT',
        type: 'limit' as const,
        side: 'buy' as const,
        status: 'filled' as const,
        filled: 1.0,
        amount: 1.0,
        price: 50000,
        remaining: 0,
        timestamp: Date.now(),
      };

      (wrappedCallback as any)(mockData);

      expect(callback).toHaveBeenCalled();
    });

    it('should detect partially filled orders as trade execution', async () => {
      await setupUserStream();
      const { callback, wrappedCallback } = await setupTradeSubscription();
      const mockData = {
        id: 'order123',
        symbol: 'BTC/USDT',
        type: 'limit' as const,
        side: 'buy' as const,
        status: 'partial',
        filled: 0.5,
        amount: 1.0,
        price: 50000,
        remaining: 0.5,
        timestamp: Date.now(),
      };

      (wrappedCallback as any)(mockData);

      expect(callback).toHaveBeenCalled();
    });

    it('should detect executed quantity as trade execution', async () => {
      await setupUserStream();
      const { callback, wrappedCallback } = await setupTradeSubscription();
      const mockData = {
        id: 'order123',
        symbol: 'BTC/USDT',
        type: 'limit' as const,
        side: 'buy' as const,
        status: 'filled' as const,
        amount: 2.0,
        filled: 1.0,
        price: 50000,
        remaining: 1.0,
        timestamp: Date.now(),
      };

      (wrappedCallback as any)(mockData);

      expect(callback).toHaveBeenCalled();
    });

    it('should not detect non-execution events', async () => {
      await setupUserStream();
      const { callback, wrappedCallback } = await setupTradeSubscription();
      const mockData = {
        status: 'open',
        filled: 0,
        amount: 1.0,
      };

      (wrappedCallback as any)(mockData);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('transformToTrade()', () => {
    it('should transform order data to trade format with all fields', async () => {
      await setupUserStream();
      const { callback, wrappedCallback } = await setupTradeSubscription();
      const mockData = {
        tradeId: 'trade123',
        id: 'order123',
        symbol: 'BTC/USDT',
        side: 'buy',
        filled: '1.5',
        price: '50000.00',
        fee: '0.01',
        timestamp: 1640995200000,
        status: 'filled',
      };

      (wrappedCallback as any)(mockData);

      expect(callback).toHaveBeenCalledWith({
        id: 'trade123',
        orderId: 'order123',
        symbol: 'BTC/USDT',
        side: 'buy',
        amount: 1.5,
        price: 50000.0,
        fee: 0.01,
        timestamp: 1640995200000,
      });
    });

    it('should handle missing fields with fallback values', async () => {
      await setupUserStream();
      const { callback, wrappedCallback } = await setupTradeSubscription();
      const mockData = {
        id: 'order123',
        symbol: 'BTC/USDT',
        side: 'sell',
        status: 'filled',
      };

      const currentTime = Date.now();
      (wrappedCallback as any)(mockData);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(/order123_\d+/),
          orderId: 'order123',
          symbol: 'BTC/USDT',
          side: 'sell',
          amount: 0,
          price: 0,
          fee: 0,
          timestamp: expect.any(Number),
        })
      );

      const actualCall = callback.mock.calls[0][0];
      expect(actualCall.timestamp).toBeGreaterThanOrEqual(currentTime);
    });

    it('should use executedQty as fallback for amount', async () => {
      await setupUserStream();
      const { callback, wrappedCallback } = await setupTradeSubscription();
      const mockData = {
        id: 'order123',
        symbol: 'BTC/USDT',
        side: 'buy',
        executedQty: '2.5',
        status: 'filled',
      };

      (wrappedCallback as any)(mockData);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 2.5,
        })
      );
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle malformed data in trade processing', async () => {
      await setupUserStream();
      const { callback, wrappedCallback } = await setupTradeSubscription();

      (wrappedCallback as any)(null);
      (wrappedCallback as any)(undefined);
      (wrappedCallback as any)({});
      (wrappedCallback as any)({ status: null, filled: null, amount: null });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle numeric string parsing errors gracefully', async () => {
      await setupUserStream();
      const { callback, wrappedCallback } = await setupTradeSubscription();
      const mockData = {
        id: 'order123',
        symbol: 'BTC/USDT',
        side: 'buy',
        filled: 'invalid_number',
        price: 'invalid_price',
        fee: 'invalid_fee',
        status: 'filled',
      };

      (wrappedCallback as any)(mockData);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: NaN,
          price: NaN,
          fee: NaN,
        })
      );
    });

    it('should handle zero filled amounts correctly', async () => {
      await setupUserStream();
      const { callback, wrappedCallback } = await setupTradeSubscription();
      const mockData = {
        status: 'open',
        filled: 0,
        amount: 1.0,
      };

      (wrappedCallback as any)(mockData);

      expect(callback).not.toHaveBeenCalled();
    });
  });
});
