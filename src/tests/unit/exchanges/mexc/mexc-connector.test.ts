import { MexcConnector } from '../../../../exchanges/mexc/mexc-connector';
import { MexcAuth } from '../../../../exchanges/mexc/mexc-auth';
import { MexcWebSocket } from '../../../../exchanges/mexc/mexc-websocket';
import { MexcUserStream } from '../../../../exchanges/mexc/mexc-user-stream';
import { MexcUtils } from '../../../../exchanges/mexc/mexc-utils';
import { Order, Ticker, OrderBook, Trade } from '../../../../types';
import { mockCredentials } from '../../../fixtures/test-helpers';

jest.mock('../../../../exchanges/mexc/mexc-auth');
jest.mock('../../../../exchanges/mexc/mexc-websocket');
jest.mock('../../../../exchanges/mexc/mexc-user-stream');
jest.mock('../../../../exchanges/mexc/mexc-utils');
jest.mock('../../../../utils');

const MockedMexcAuth = MexcAuth as jest.MockedClass<typeof MexcAuth>;
const MockedMexcWebSocket = MexcWebSocket as jest.MockedClass<typeof MexcWebSocket>;
const MockedMexcUserStream = MexcUserStream as jest.MockedClass<typeof MexcUserStream>;
const MockedMexcUtils = MexcUtils as jest.Mocked<typeof MexcUtils>;

class TestableMexcConnector extends MexcConnector {
  public testAuth?: MexcAuth;
  public testWebSocket?: MexcWebSocket;
  public testUserStream?: MexcUserStream;

  constructor(
    auth?: MexcAuth,
    webSocket?: MexcWebSocket,
    userStream?: MexcUserStream
  ) {
    super();
    this.testAuth = auth;
    this.testWebSocket = webSocket;
    this.testUserStream = userStream;
  }

  getCredentials() {
    return {
      apiKey: mockCredentials.apiKey,
      secret: mockCredentials.apiSecret
    };
  }

  handleError(error: unknown, context?: string): never {
    throw error;
  }

  async connect(): Promise<void> {
    try {
      const credentials = this.getCredentials();
      
      if (this.testAuth) {
        this['auth'] = this.testAuth;
      } else {
        this['auth'] = new MexcAuth(credentials, 'https://api.mexc.com/api/v3');
      }

      if (this.testUserStream) {
        this['userStream'] = this.testUserStream;
      } else {
        this['userStream'] = new MexcUserStream(
          (endpoint: string, params: Record<string, unknown>, method: string) => 
            this['auth']!.makeRequest(endpoint, params, method as 'GET' | 'POST' | 'PUT' | 'DELETE')
        );
      }
      
      if (!this['auth'].validateCredentials()) {
        throw new Error('Invalid MEXC credentials');
      }

      this['connected'] = true;
    } catch (error: unknown) {
      this['connected'] = false;
      this.handleError(error, 'connect');
    }
  }

  async connectWebSocket(): Promise<void> {
    if (!this.testWebSocket && !this['ws']) {
      this['ws'] = new MexcWebSocket();
    } else if (this.testWebSocket && !this['ws']) {
      this['ws'] = this.testWebSocket;
    }
    await this['ws']!.connectWebSocket();
  }

  public isConnected(): boolean {
    return this['connected'];
  }

  public hasAuth(): boolean {
    return !!this['auth'];
  }

  public hasUserStream(): boolean {
    return !!this['userStream'];
  }

  public async testMakeRequest(endpoint: string, params: Record<string, unknown> = {}, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET'): Promise<any> {
    if (!this['auth']) {
      throw new Error('MEXC connector not authenticated');
    }
    return this['auth'].makeRequest(endpoint, params, method);
  }

  public async testMakePublicRequest(endpoint: string, params: Record<string, unknown> = {}): Promise<any> {
    if (!this['auth']) {
      throw new Error('MEXC connector not authenticated');
    }
    return this['auth'].makePublicRequest(endpoint, params);
  }
}

describe('MexcConnector', () => {
  let connector: TestableMexcConnector;
  let mockAuth: jest.Mocked<MexcAuth>;
  let mockWebSocket: jest.Mocked<MexcWebSocket>;
  let mockUserStream: jest.Mocked<MexcUserStream>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuth = {
      validateCredentials: jest.fn().mockReturnValue(true),
      makeRequest: jest.fn(),
      makePublicRequest: jest.fn(),
      createPublicHeaders: jest.fn().mockReturnValue({}),
    } as any;

    mockWebSocket = {
      connectWebSocket: jest.fn(),
      disconnectWebSocket: jest.fn(),
      subscribeTicker: jest.fn(),
      subscribeOrderBook: jest.fn(),
      subscribeTrades: jest.fn(),
      subscribeOrders: jest.fn(),
      unsubscribe: jest.fn(),
      isConnected: jest.fn(),
      getWebSocketStatus: jest.fn(),
      subscribeToUserData: jest.fn(),
    } as any;

    mockUserStream = {
      connectUserDataStream: jest.fn(),
      disconnectUserDataStream: jest.fn(),
      subscribeUserOrders: jest.fn(),
      subscribeUserTrades: jest.fn(),
      isUserDataStreamConnected: jest.fn(),
      getListenKey: jest.fn(),
      keepAliveListenKey: jest.fn(),
      deleteListenKey: jest.fn(),
    } as any;

    MockedMexcAuth.mockImplementation(() => mockAuth);
    MockedMexcWebSocket.mockImplementation(() => mockWebSocket);
    MockedMexcUserStream.mockImplementation(() => mockUserStream);

    connector = new TestableMexcConnector(mockAuth, mockWebSocket, mockUserStream);
  });

  describe('constructor', () => {
    it('should initialize with correct base URL', () => {
      expect(connector).toBeDefined();
      expect(connector).toBeInstanceOf(MexcConnector);
    });
  });

  describe('connect', () => {
    it('should successfully connect with valid credentials', async () => {
      await connector.connect();

      expect(mockAuth.validateCredentials).toHaveBeenCalled();
      expect(connector.isConnected()).toBe(true);
      expect(connector.hasAuth()).toBe(true);
      expect(connector.hasUserStream()).toBe(true);
    });

    it('should fail to connect with invalid credentials', async () => {
      mockAuth.validateCredentials.mockReturnValue(false);

      await expect(connector.connect()).rejects.toThrow('Invalid MEXC credentials');
      expect(connector.isConnected()).toBe(false);
    });

    it('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      mockAuth.validateCredentials.mockImplementation(() => {
        throw error;
      });

      await expect(connector.connect()).rejects.toThrow('Connection failed');
      expect(connector.isConnected()).toBe(false);
    });
  });

  describe('disconnect', () => {
    beforeEach(async () => {
      await connector.connect();
      await connector.connectWebSocket();
    });

    it('should disconnect all components', async () => {
      mockWebSocket.disconnectWebSocket.mockResolvedValue(undefined);
      mockUserStream.disconnectUserDataStream.mockResolvedValue(undefined);

      await connector.disconnect();

      expect(mockWebSocket.disconnectWebSocket).toHaveBeenCalled();
      expect(mockUserStream.disconnectUserDataStream).toHaveBeenCalled();
      expect(connector.isConnected()).toBe(false);
      expect(connector.hasAuth()).toBe(false);
      expect(connector.hasUserStream()).toBe(false);
    });
  });

  describe('getBalance', () => {
    beforeEach(async () => {
      await connector.connect();
    });

    it('should return all balances when no asset specified', async () => {
      const mockAccountData = {
        balances: [
          { asset: 'BTC', free: '1.0', locked: '0.5' },
          { asset: 'USDT', free: '1000.0', locked: '0.0' },
          { asset: 'ETH', free: '0.0', locked: '0.0' }
        ]
      };

      mockAuth.makeRequest.mockResolvedValue(mockAccountData);

      const result = await connector.getBalance();

      expect(mockAuth.makeRequest).toHaveBeenCalledWith('/account', {}, 'GET');
      expect(result).toEqual({
        BTC: {
          asset: 'BTC',
          free: 1.0,
          used: 0.5,
          total: 1.5,
          available: 1.0
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

    it('should return specific balance when asset specified', async () => {
      const mockAccountData = {
        balances: [
          { asset: 'BTC', free: '1.0', locked: '0.5' }
        ]
      };

      mockAuth.makeRequest.mockResolvedValue(mockAccountData);

      const result = await connector.getBalance('BTC');

      expect(result).toEqual({
        asset: 'BTC',
        free: 1.0,
        used: 0.5,
        total: 1.5,
        available: 1.0
      });
    });

    it('should return zero balance when asset not found', async () => {
      const mockAccountData = { balances: [] };
      mockAuth.makeRequest.mockResolvedValue(mockAccountData);

      const result = await connector.getBalance('ETH');

      expect(result).toEqual({
        asset: 'ETH',
        free: 0,
        used: 0,
        total: 0,
        available: 0
      });
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      mockAuth.makeRequest.mockRejectedValue(error);

      await expect(connector.getBalance()).rejects.toThrow('API Error');
    });

    it('should require authentication', async () => {
      const unauthenticatedConnector = new MexcConnector();

      await expect(unauthenticatedConnector.getBalance()).rejects.toThrow('MEXC connector not authenticated');
    });
  });

  describe('createOrder', () => {
    beforeEach(async () => {
      await connector.connect();
    });

    it('should create a limit order successfully', async () => {
      const mockOrderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: '1.5',
        price: '50000',
        timeInForce: 'GTC'
      };

      const mockApiResponse = { orderId: '12345' };
      const mockTransformedOrder: Order = {
        id: '12345',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        amount: 1.5,
        price: 50000,
        filled: 0,
        remaining: 1.5,
        status: 'open',
        timestamp: 1234567890
      };

      MockedMexcUtils.createOrderParams.mockReturnValue(mockOrderParams);
      MockedMexcUtils.toMexcSymbol.mockReturnValue('BTCUSDT');
      MockedMexcUtils.transformOrder.mockReturnValue(mockTransformedOrder);
      mockAuth.makeRequest.mockResolvedValue(mockApiResponse);

      const result = await connector.createOrder('BTC/USDT', 'limit', 'buy', 1.5, 50000);

      expect(MockedMexcUtils.createOrderParams).toHaveBeenCalledWith('BTC/USDT', 'limit', 'buy', 1.5, 50000);
      expect(mockAuth.makeRequest).toHaveBeenCalledWith('/order', mockOrderParams, 'POST');
      expect(MockedMexcUtils.transformOrder).toHaveBeenCalledWith({
        orderId: '12345',
        symbol: 'BTCUSDT',
        type: 'LIMIT',
        side: 'BUY',
        origQty: '1.5',
        price: '50000',
        executedQty: '0',
        status: 'NEW',
        time: expect.any(Number)
      });
      expect(result).toEqual(mockTransformedOrder);
    });

    it('should create a market order successfully', async () => {
      const mockOrderParams = {
        symbol: 'BTCUSDT',
        side: 'SELL',
        type: 'MARKET',
        quantity: '1.0'
      };

      const mockApiResponse = { orderId: '54321' };
      const mockTransformedOrder: Order = {
        id: '54321',
        symbol: 'BTC/USDT',
        type: 'market',
        side: 'sell',
        amount: 1.0,
        filled: 0,
        remaining: 1.0,
        status: 'open',
        timestamp: 1234567890
      };

      MockedMexcUtils.createOrderParams.mockReturnValue(mockOrderParams);
      MockedMexcUtils.toMexcSymbol.mockReturnValue('BTCUSDT');
      MockedMexcUtils.transformOrder.mockReturnValue(mockTransformedOrder);
      mockAuth.makeRequest.mockResolvedValue(mockApiResponse);

      const result = await connector.createOrder('BTC/USDT', 'market', 'sell', 1.0);

      expect(MockedMexcUtils.createOrderParams).toHaveBeenCalledWith('BTC/USDT', 'market', 'sell', 1.0, undefined);
      expect(mockAuth.makeRequest).toHaveBeenCalledWith('/order', mockOrderParams, 'POST');
      expect(result).toEqual(mockTransformedOrder);
    });

    it('should handle order creation errors', async () => {
      const error = new Error('Insufficient balance');
      MockedMexcUtils.createOrderParams.mockReturnValue({} as any);
      mockAuth.makeRequest.mockRejectedValue(error);

      await expect(connector.createOrder('BTC/USDT', 'limit', 'buy', 1.5, 50000)).rejects.toThrow('Insufficient balance');
    });

    it('should require authentication', async () => {
      const unauthenticatedConnector = new MexcConnector();

      await expect(unauthenticatedConnector.createOrder('BTC/USDT', 'limit', 'buy', 1.5, 50000)).rejects.toThrow('MEXC connector not authenticated');
    });
  });

  describe('cancelOrder', () => {
    beforeEach(async () => {
      await connector.connect();
    });

    it('should cancel an order successfully', async () => {
      MockedMexcUtils.toMexcSymbol.mockReturnValue('BTCUSDT');
      mockAuth.makeRequest.mockResolvedValue({});

      await connector.cancelOrder('12345', 'BTC/USDT');

      expect(MockedMexcUtils.toMexcSymbol).toHaveBeenCalledWith('BTC/USDT');
      expect(mockAuth.makeRequest).toHaveBeenCalledWith('/order', {
        symbol: 'BTCUSDT',
        orderId: '12345'
      }, 'DELETE');
    });

    it('should handle cancellation errors', async () => {
      const error = new Error('Order not found');
      MockedMexcUtils.toMexcSymbol.mockReturnValue('BTCUSDT');
      mockAuth.makeRequest.mockRejectedValue(error);

      await expect(connector.cancelOrder('12345', 'BTC/USDT')).rejects.toThrow('Order not found');
    });

    it('should require authentication', async () => {
      const unauthenticatedConnector = new MexcConnector();

      await expect(unauthenticatedConnector.cancelOrder('12345', 'BTC/USDT')).rejects.toThrow('MEXC connector not authenticated');
    });
  });

  describe('getOrder', () => {
    beforeEach(async () => {
      await connector.connect();
    });

    it('should get order details successfully', async () => {
      const mockApiResponse = [{
        orderId: '12345',
        symbol: 'BTCUSDT',
        type: 'LIMIT',
        side: 'BUY',
        origQty: '1.5',
        price: '50000',
        executedQty: '0.5',
        status: 'PARTIALLY_FILLED',
        time: 1234567890
      }];

      const mockTransformedOrder: Order = {
        id: '12345',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        amount: 1.5,
        price: 50000,
        filled: 0.5,
        remaining: 1.0,
        status: 'open',
        timestamp: 1234567890
      };

      MockedMexcUtils.toMexcSymbol.mockReturnValue('BTCUSDT');
      MockedMexcUtils.transformOrder.mockReturnValue(mockTransformedOrder);
      mockAuth.makeRequest.mockResolvedValue(mockApiResponse);

      const result = await connector.getOrder('12345', 'BTC/USDT');

      expect(mockAuth.makeRequest).toHaveBeenCalledWith('/allOrders', {
        symbol: 'BTCUSDT',
        orderId: '12345'
      }, 'GET');
      expect(MockedMexcUtils.transformOrder).toHaveBeenCalledWith(mockApiResponse[0]);
      expect(result).toEqual(mockTransformedOrder);
    });

    it('should handle order not found', async () => {
      MockedMexcUtils.toMexcSymbol.mockReturnValue('BTCUSDT');
      mockAuth.makeRequest.mockResolvedValue([]);

      await expect(connector.getOrder('12345', 'BTC/USDT')).rejects.toThrow('Order not found');
    });

    it('should require authentication', async () => {
      const unauthenticatedConnector = new MexcConnector();

      await expect(unauthenticatedConnector.getOrder('12345', 'BTC/USDT')).rejects.toThrow('MEXC connector not authenticated');
    });
  });

  describe('getOpenOrders', () => {
    beforeEach(async () => {
      await connector.connect();
    });

    it('should get all open orders when no symbol specified', async () => {
      const mockApiResponse = [
        { orderId: '1', symbol: 'BTCUSDT', status: 'NEW' },
        { orderId: '2', symbol: 'ETHUSDT', status: 'PARTIALLY_FILLED' }
      ];

      const mockTransformedOrders: Order[] = [
        { id: '1', symbol: 'BTC/USDT', type: 'limit', side: 'buy', amount: 1, filled: 0, remaining: 1, status: 'open', timestamp: 123 },
        { id: '2', symbol: 'ETH/USDT', type: 'limit', side: 'sell', amount: 2, filled: 0.5, remaining: 1.5, status: 'open', timestamp: 456 }
      ];

      MockedMexcUtils.transformOrder.mockReturnValueOnce(mockTransformedOrders[0]).mockReturnValueOnce(mockTransformedOrders[1]);
      mockAuth.makeRequest.mockResolvedValue(mockApiResponse);

      const result = await connector.getOpenOrders();

      expect(mockAuth.makeRequest).toHaveBeenCalledWith('/openOrders', {}, 'GET');
      expect(result).toEqual(mockTransformedOrders);
    });

    it('should get open orders for specific symbol', async () => {
      const mockApiResponse = [
        { orderId: '1', symbol: 'BTCUSDT', status: 'NEW' }
      ];

      const mockTransformedOrder: Order = {
        id: '1', symbol: 'BTC/USDT', type: 'limit', side: 'buy', amount: 1, filled: 0, remaining: 1, status: 'open', timestamp: 123
      };

      MockedMexcUtils.toMexcSymbol.mockReturnValue('BTCUSDT');
      MockedMexcUtils.transformOrder.mockReturnValue(mockTransformedOrder);
      mockAuth.makeRequest.mockResolvedValue(mockApiResponse);

      const result = await connector.getOpenOrders('BTC/USDT');

      expect(mockAuth.makeRequest).toHaveBeenCalledWith('/openOrders', { symbol: 'BTCUSDT' }, 'GET');
      expect(result).toEqual([mockTransformedOrder]);
    });

    it('should require authentication', async () => {
      const unauthenticatedConnector = new MexcConnector();

      await expect(unauthenticatedConnector.getOpenOrders()).rejects.toThrow('MEXC connector not authenticated');
    });
  });

  describe('getTicker', () => {
    beforeEach(async () => {
      await connector.connect();
    });

    it('should get ticker data successfully', async () => {
      const mockPriceData = { symbol: 'BTCUSDT', price: '50000' };
      const mockStatsData = { bidPrice: '49999', askPrice: '50001', volume: '100' };
      const mockTransformedTicker: Ticker = {
        symbol: 'BTC/USDT',
        last: 50000,
        bid: 49999,
        ask: 50001,
        baseVolume: 100,
        timestamp: 1234567890
      };

      MockedMexcUtils.toMexcSymbol.mockReturnValue('BTCUSDT');
      MockedMexcUtils.transformTicker.mockReturnValue(mockTransformedTicker);
      mockAuth.makePublicRequest
        .mockResolvedValueOnce(mockPriceData)
        .mockResolvedValueOnce(mockStatsData);

      const result = await connector.getTicker('BTC/USDT');

      expect(mockAuth.makePublicRequest).toHaveBeenCalledWith('/ticker/price', { symbol: 'BTCUSDT' });
      expect(mockAuth.makePublicRequest).toHaveBeenCalledWith('/ticker/24hr', { symbol: 'BTCUSDT' });
      expect(MockedMexcUtils.transformTicker).toHaveBeenCalledWith(mockPriceData, mockStatsData);
      expect(result).toEqual(mockTransformedTicker);
    });

    it('should handle API errors', async () => {
      const error = new Error('Symbol not found');
      MockedMexcUtils.toMexcSymbol.mockReturnValue('BTCUSDT');
      mockAuth.makePublicRequest.mockRejectedValue(error);

      await expect(connector.getTicker('BTC/USDT')).rejects.toThrow('Symbol not found');
    });

    it('should require authentication', async () => {
      const unauthenticatedConnector = new MexcConnector();

      await expect(unauthenticatedConnector.getTicker('BTC/USDT')).rejects.toThrow('MEXC connector not authenticated');
    });
  });

  describe('getOrderBook', () => {
    beforeEach(async () => {
      await connector.connect();
    });

    it('should get order book successfully', async () => {
      const mockApiResponse = {
        bids: [['49999', '1.0'], ['49998', '2.0']],
        asks: [['50001', '1.5'], ['50002', '0.5']]
      };

      const mockTransformedOrderBook: OrderBook = {
        symbol: 'BTC/USDT',
        bids: [{ price: 49999, amount: 1.0 }, { price: 49998, amount: 2.0 }],
        asks: [{ price: 50001, amount: 1.5 }, { price: 50002, amount: 0.5 }],
        timestamp: 1234567890
      };

      MockedMexcUtils.toMexcSymbol.mockReturnValue('BTCUSDT');
      MockedMexcUtils.transformOrderBook.mockReturnValue(mockTransformedOrderBook);
      mockAuth.makePublicRequest.mockResolvedValue(mockApiResponse);

      const result = await connector.getOrderBook('BTC/USDT');

      expect(mockAuth.makePublicRequest).toHaveBeenCalledWith('/depth', {
        symbol: 'BTCUSDT',
        limit: 100
      });
      expect(MockedMexcUtils.transformOrderBook).toHaveBeenCalledWith(mockApiResponse, 'BTC/USDT');
      expect(result).toEqual(mockTransformedOrderBook);
    });

    it('should require authentication', async () => {
      const unauthenticatedConnector = new MexcConnector();

      await expect(unauthenticatedConnector.getOrderBook('BTC/USDT')).rejects.toThrow('MEXC connector not authenticated');
    });
  });

  describe('getRecentTrades', () => {
    beforeEach(async () => {
      await connector.connect();
    });

    it('should get recent trades successfully', async () => {
      const mockApiResponse = [
        { id: 1, price: '50000', qty: '1.0', time: 1234567890, isBuyerMaker: false },
        { id: 2, price: '49999', qty: '0.5', time: 1234567891, isBuyerMaker: true }
      ];

      const mockTransformedTrades: Trade[] = [
        { id: '1', symbol: 'BTC/USDT', side: 'buy', amount: 1.0, price: 50000, timestamp: 1234567890 },
        { id: '2', symbol: 'BTC/USDT', side: 'sell', amount: 0.5, price: 49999, timestamp: 1234567891 }
      ];

      MockedMexcUtils.toMexcSymbol.mockReturnValue('BTCUSDT');
      MockedMexcUtils.transformTrade
        .mockReturnValueOnce(mockTransformedTrades[0])
        .mockReturnValueOnce(mockTransformedTrades[1]);
      mockAuth.makePublicRequest.mockResolvedValue(mockApiResponse);

      const result = await connector.getRecentTrades('BTC/USDT');

      expect(mockAuth.makePublicRequest).toHaveBeenCalledWith('/trades', {
        symbol: 'BTCUSDT',
        limit: 100
      });
      expect(MockedMexcUtils.transformTrade).toHaveBeenCalledWith(mockApiResponse[0], 'BTC/USDT');
      expect(MockedMexcUtils.transformTrade).toHaveBeenCalledWith(mockApiResponse[1], 'BTC/USDT');
      expect(result).toEqual(mockTransformedTrades);
    });

    it('should require authentication', async () => {
      const unauthenticatedConnector = new MexcConnector();

      await expect(unauthenticatedConnector.getRecentTrades('BTC/USDT')).rejects.toThrow('MEXC connector not authenticated');
    });
  });

  describe('WebSocket methods', () => {
    beforeEach(async () => {
      await connector.connect();
      (connector as any).ws = mockWebSocket;
    });

    describe('connectWebSocket', () => {
      it('should connect WebSocket successfully', async () => {
        mockWebSocket.connectWebSocket.mockResolvedValue(undefined);

        await connector.connectWebSocket();

        expect(mockWebSocket.connectWebSocket).toHaveBeenCalled();
      });

      it('should create new WebSocket if not exists', async () => {
        connector.testWebSocket = undefined;
        (connector as any).ws = undefined;
        mockWebSocket.connectWebSocket.mockResolvedValue(undefined);

        await connector.connectWebSocket();

        expect(MockedMexcWebSocket).toHaveBeenCalled();
        expect(mockWebSocket.connectWebSocket).toHaveBeenCalled();
      });
    });

    describe('disconnectWebSocket', () => {
      it('should disconnect WebSocket if connected', async () => {
        mockWebSocket.disconnectWebSocket.mockResolvedValue(undefined);

        await connector.disconnectWebSocket();

        expect(mockWebSocket.disconnectWebSocket).toHaveBeenCalled();
        expect((connector as any).ws).toBeUndefined();
      });

      it('should handle when WebSocket is not connected', async () => {
        (connector as any).ws = undefined;

        await connector.disconnectWebSocket();

        expect(mockWebSocket.disconnectWebSocket).not.toHaveBeenCalled();
      });
    });

    describe('subscribeTicker', () => {
      it('should subscribe to ticker successfully', async () => {
        const callback = jest.fn();
        const subscriptionId = 'ticker_subscription_1';
        mockWebSocket.subscribeTicker.mockResolvedValue(subscriptionId);

        const result = await connector.subscribeTicker('BTC/USDT', callback);

        expect(mockWebSocket.subscribeTicker).toHaveBeenCalledWith('BTC/USDT', callback);
        expect(result).toBe(subscriptionId);
      });

      it('should throw error if WebSocket not connected', async () => {
        (connector as any).ws = undefined;
        const callback = jest.fn();

        await expect(connector.subscribeTicker('BTC/USDT', callback))
          .rejects.toThrow('WebSocket not connected. Call connectWebSocket() first.');
      });
    });

    describe('subscribeOrderBook', () => {
      it('should subscribe to order book successfully', async () => {
        const callback = jest.fn();
        const subscriptionId = 'orderbook_subscription_1';
        mockWebSocket.subscribeOrderBook.mockResolvedValue(subscriptionId);

        const result = await connector.subscribeOrderBook('BTC/USDT', callback);

        expect(mockWebSocket.subscribeOrderBook).toHaveBeenCalledWith('BTC/USDT', callback);
        expect(result).toBe(subscriptionId);
      });

      it('should throw error if WebSocket not connected', async () => {
        (connector as any).ws = undefined;
        const callback = jest.fn();

        await expect(connector.subscribeOrderBook('BTC/USDT', callback))
          .rejects.toThrow('WebSocket not connected. Call connectWebSocket() first.');
      });
    });

    describe('subscribeTrades', () => {
      it('should subscribe to trades successfully', async () => {
        const callback = jest.fn();
        const subscriptionId = 'trades_subscription_1';
        mockWebSocket.subscribeTrades.mockResolvedValue(subscriptionId);

        const result = await connector.subscribeTrades('BTC/USDT', callback);

        expect(mockWebSocket.subscribeTrades).toHaveBeenCalledWith('BTC/USDT', callback);
        expect(result).toBe(subscriptionId);
      });

      it('should throw error if WebSocket not connected', async () => {
        (connector as any).ws = undefined;
        const callback = jest.fn();

        await expect(connector.subscribeTrades('BTC/USDT', callback))
          .rejects.toThrow('WebSocket not connected. Call connectWebSocket() first.');
      });
    });

    describe('subscribeOrders', () => {
      it('should subscribe to orders successfully', async () => {
        const callback = jest.fn();
        const subscriptionId = 'orders_subscription_1';
        mockWebSocket.subscribeOrders.mockResolvedValue(subscriptionId);

        const result = await connector.subscribeOrders(callback);

        expect(mockWebSocket.subscribeOrders).toHaveBeenCalledWith(callback);
        expect(result).toBe(subscriptionId);
      });

      it('should throw error if WebSocket not connected', async () => {
        (connector as any).ws = undefined;
        const callback = jest.fn();

        await expect(connector.subscribeOrders(callback))
          .rejects.toThrow('WebSocket not connected. Call connectWebSocket() first.');
      });
    });

    describe('unsubscribe', () => {
      it('should unsubscribe successfully', async () => {
        const subscriptionId = 'subscription_1';
        mockWebSocket.unsubscribe.mockResolvedValue(undefined);

        await connector.unsubscribe(subscriptionId);

        expect(mockWebSocket.unsubscribe).toHaveBeenCalledWith(subscriptionId);
      });

      it('should throw error if WebSocket not connected', async () => {
        (connector as any).ws = undefined;

        await expect(connector.unsubscribe('subscription_1'))
          .rejects.toThrow('WebSocket not connected.');
      });
    });

    describe('isWebSocketConnected', () => {
      it('should return WebSocket connection status', () => {
        mockWebSocket.isConnected.mockReturnValue(true);

        const result = connector.isWebSocketConnected();

        expect(mockWebSocket.isConnected).toHaveBeenCalled();
        expect(result).toBe(true);
      });

      it('should return false when WebSocket not initialized', () => {
        (connector as any).ws = undefined;

        const result = connector.isWebSocketConnected();

        expect(result).toBe(false);
      });
    });

    describe('getWebSocketStatus', () => {
      it('should return WebSocket status', () => {
        mockWebSocket.getWebSocketStatus.mockReturnValue('connected');

        const result = connector.getWebSocketStatus();

        expect(mockWebSocket.getWebSocketStatus).toHaveBeenCalled();
        expect(result).toBe('connected');
      });

      it('should return disconnected when WebSocket not initialized', () => {
        (connector as any).ws = undefined;

        const result = connector.getWebSocketStatus();

        expect(result).toBe('disconnected');
      });
    });
  });

  describe('User Data Stream methods', () => {
    beforeEach(async () => {
      await connector.connect();
    });

    describe('connectUserDataStream', () => {
      it('should connect user data stream successfully', async () => {
        mockUserStream.connectUserDataStream.mockResolvedValue(undefined);

        await connector.connectUserDataStream();

        expect(mockUserStream.connectUserDataStream).toHaveBeenCalled();
      });

      it('should throw error if user stream not initialized', async () => {
        (connector as any).userStream = undefined;

        await expect(connector.connectUserDataStream())
          .rejects.toThrow('User stream not initialized');
      });
    });

    describe('disconnectUserDataStream', () => {
      it('should disconnect user data stream successfully', async () => {
        mockUserStream.disconnectUserDataStream.mockResolvedValue(undefined);

        await connector.disconnectUserDataStream();

        expect(mockUserStream.disconnectUserDataStream).toHaveBeenCalled();
      });

      it('should handle gracefully when user stream not initialized', async () => {
        (connector as any).userStream = undefined;

        await expect(connector.disconnectUserDataStream()).resolves.not.toThrow();
      });
    });

    describe('subscribeUserOrders', () => {
      it('should subscribe to user orders successfully', async () => {
        const callback = jest.fn();
        const subscriptionId = 'user_orders_subscription_1';
        mockUserStream.subscribeUserOrders.mockResolvedValue(subscriptionId);

        const result = await connector.subscribeUserOrders(callback);

        expect(mockUserStream.subscribeUserOrders).toHaveBeenCalledWith(callback);
        expect(result).toBe(subscriptionId);
      });

      it('should throw error if user stream not initialized', async () => {
        (connector as any).userStream = undefined;
        const callback = jest.fn();

        await expect(connector.subscribeUserOrders(callback))
          .rejects.toThrow('User stream not initialized');
      });
    });

    describe('subscribeUserTrades', () => {
      it('should subscribe to user trades successfully', async () => {
        const callback = jest.fn();
        const subscriptionId = 'user_trades_subscription_1';
        mockUserStream.subscribeUserTrades.mockResolvedValue(subscriptionId);

        const result = await connector.subscribeUserTrades(callback);

        expect(mockUserStream.subscribeUserTrades).toHaveBeenCalledWith(callback);
        expect(result).toBe(subscriptionId);
      });

      it('should throw error if user stream not initialized', async () => {
        (connector as any).userStream = undefined;
        const callback = jest.fn();

        await expect(connector.subscribeUserTrades(callback))
          .rejects.toThrow('User stream not initialized');
      });
    });

    describe('isUserDataStreamConnected', () => {
      it('should return user data stream connection status', () => {
        mockUserStream.isUserDataStreamConnected.mockReturnValue(true);

        const result = connector.isUserDataStreamConnected();

        expect(mockUserStream.isUserDataStreamConnected).toHaveBeenCalled();
        expect(result).toBe(true);
      });

      it('should return false when user stream not initialized', () => {
        (connector as any).userStream = undefined;

        const result = connector.isUserDataStreamConnected();

        expect(result).toBe(false);
      });
    });
  });

  describe('private methods', () => {
    describe('makeRequest', () => {
      beforeEach(async () => {
        await connector.connect();
      });

      it('should delegate to auth makeRequest', async () => {
        const endpoint = '/test';
        const params = { param1: 'value1' };
        const method = 'POST';
        const expectedResponse = { result: 'success' };

        mockAuth.makeRequest.mockResolvedValue(expectedResponse);

        const result = await connector.testMakeRequest(endpoint, params, method);

        expect(mockAuth.makeRequest).toHaveBeenCalledWith(endpoint, params, method);
        expect(result).toBe(expectedResponse);
      });

      it('should use default parameters', async () => {
        const endpoint = '/test';
        const expectedResponse = { result: 'success' };

        mockAuth.makeRequest.mockResolvedValue(expectedResponse);

        const result = await connector.testMakeRequest(endpoint);

        expect(mockAuth.makeRequest).toHaveBeenCalledWith(endpoint, {}, 'GET');
        expect(result).toBe(expectedResponse);
      });

      it('should throw error when not authenticated', async () => {
        const unauthenticatedConnector = new MexcConnector();

        await expect((unauthenticatedConnector as any).makeRequest('/test'))
          .rejects.toThrow('MEXC connector not authenticated');
      });
    });

    describe('makePublicRequest', () => {
      beforeEach(async () => {
        await connector.connect();
      });

      it('should delegate to auth makePublicRequest', async () => {
        const endpoint = '/test';
        const params = { param1: 'value1' };
        const expectedResponse = { result: 'success' };

        mockAuth.makePublicRequest.mockResolvedValue(expectedResponse);

        const result = await connector.testMakePublicRequest(endpoint, params);

        expect(mockAuth.makePublicRequest).toHaveBeenCalledWith(endpoint, params);
        expect(result).toBe(expectedResponse);
      });

      it('should use default parameters', async () => {
        const endpoint = '/test';
        const expectedResponse = { result: 'success' };

        mockAuth.makePublicRequest.mockResolvedValue(expectedResponse);

        const result = await connector.testMakePublicRequest(endpoint);

        expect(mockAuth.makePublicRequest).toHaveBeenCalledWith(endpoint, {});
        expect(result).toBe(expectedResponse);
      });

      it('should throw error when not authenticated', async () => {
        const unauthenticatedConnector = new MexcConnector();

        await expect((unauthenticatedConnector as any).makePublicRequest('/test'))
          .rejects.toThrow('MEXC connector not authenticated');
      });
    });
  });
});