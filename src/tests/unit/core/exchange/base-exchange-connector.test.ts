import { BaseExchangeConnector } from '../../../../core/exchange/base-exchange-connector';
import { OrderType, OrderSide, WebSocketStatus } from '../../../../types';

class MockExchangeConnector extends BaseExchangeConnector {
  constructor() {
    super('test-exchange', 'Test Exchange');
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async getBalance() {
    return {};
  }

  async createOrder(
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price?: number
  ) {
    return {
      id: 'test-order',
      symbol,
      type,
      side,
      amount,
      price: price || 0,
      status: 'open' as const,
      timestamp: Date.now(),
      filled: 0,
      remaining: amount,
    };
  }

  async cancelOrder(): Promise<void> {}
  async cancelAllOrders(): Promise<void> {}
  async getOrder() {
    return this.createOrder('BTCUSDT', 'limit', 'buy', 1, 50000);
  }
  async getOpenOrders() {
    return [];
  }
  async getTicker() {
    return {
      symbol: 'BTCUSDT',
      bid: 50000,
      ask: 50001,
      last: 50000.5,
      baseVolume: 1000,
      timestamp: Date.now(),
    };
  }
  async getOrderBook() {
    return { symbol: 'BTCUSDT', bids: [], asks: [], timestamp: Date.now() };
  }
  async getRecentTrades() {
    return [];
  }

  async connectWebSocket(): Promise<void> {}
  async disconnectWebSocket(): Promise<void> {}
  async subscribeTicker() {
    return 'ticker-sub-id';
  }
  async subscribeOrderBook() {
    return 'orderbook-sub-id';
  }
  async subscribeTrades() {
    return 'trades-sub-id';
  }
  async subscribeOrders() {
    return 'orders-sub-id';
  }
  async unsubscribe(): Promise<void> {}

  isWebSocketConnected() {
    return false;
  }
  getWebSocketStatus(): WebSocketStatus {
    return 'disconnected';
  }

  async connectUserDataStream(): Promise<void> {}
  async disconnectUserDataStream(): Promise<void> {}
  async subscribeUserOrders() {
    return 'user-orders-sub-id';
  }
  async subscribeUserTrades() {
    return 'user-trades-sub-id';
  }
  isUserDataStreamConnected() {
    return false;
  }

  testHandleError(error: unknown, operation: string) {
    return this.handleError(error, operation);
  }

  testGetCredentials() {
    return this.getCredentials();
  }
}

describe('BaseExchangeConnector', () => {
  let connector: MockExchangeConnector;

  beforeEach(() => {
    connector = new MockExchangeConnector();
  });

  describe('constructor and getters', () => {
    it('should initialize with correct id and name', () => {
      expect(connector.id).toBe('test-exchange');
      expect(connector.name).toBe('Test Exchange');
    });

    it('should start with disconnected state', () => {
      expect(connector.isConnected()).toBe(false);
    });
  });

  describe('connection management', () => {
    it('should update connected state on connect', async () => {
      await connector.connect();
      expect(connector.isConnected()).toBe(true);
    });

    it('should update connected state on disconnect', async () => {
      await connector.connect();
      expect(connector.isConnected()).toBe(true);

      await connector.disconnect();
      expect(connector.isConnected()).toBe(false);
    });
  });

  describe('credentials management', () => {
    it('should set and retrieve credentials', () => {
      const credentials = {
        apiKey: 'test-key',
        secret: 'test-secret',
        passphrase: 'test-passphrase',
        uid: 'test-uid',
      };

      connector.setCredentials(credentials);
      expect(connector.testGetCredentials()).toEqual(credentials);
    });

    it('should throw error when getting credentials without setting them', () => {
      expect(() => connector.testGetCredentials()).toThrow('No credentials set for Test Exchange');
    });
  });

  describe('error handling', () => {
    it('should handle Error objects correctly', () => {
      const error = new Error('Test error message');

      expect(() => connector.testHandleError(error, 'testOperation')).toThrow(
        'Test Exchange testOperation failed: Test error message'
      );
    });

    it('should handle string errors correctly', () => {
      const error = 'String error message';

      expect(() => connector.testHandleError(error, 'testOperation')).toThrow(
        'Test Exchange testOperation failed: String error message'
      );
    });

    it('should handle unknown error types', () => {
      const error = { some: 'object' };

      expect(() => connector.testHandleError(error, 'testOperation')).toThrow(
        'Test Exchange testOperation failed: Unknown error'
      );
    });

    it('should handle null and undefined errors', () => {
      expect(() => connector.testHandleError(null, 'testOperation')).toThrow(
        'Test Exchange testOperation failed: Unknown error'
      );

      expect(() => connector.testHandleError(undefined, 'testOperation')).toThrow(
        'Test Exchange testOperation failed: Unknown error'
      );
    });
  });

  describe('abstract method implementations', () => {
    it('should implement order creation', async () => {
      const order = await connector.createOrder('BTCUSDT', 'limit', 'buy', 1, 50000);

      expect(order.id).toBe('test-order');
      expect(order.symbol).toBe('BTCUSDT');
      expect(order.type).toBe('limit');
      expect(order.side).toBe('buy');
      expect(order.amount).toBe(1);
      expect(order.price).toBe(50000);
    });

    it('should implement ticker subscription', async () => {
      const subId = await connector.subscribeTicker();
      expect(subId).toBe('ticker-sub-id');
    });

    it('should implement orderbook subscription', async () => {
      const subId = await connector.subscribeOrderBook();
      expect(subId).toBe('orderbook-sub-id');
    });

    it('should implement trades subscription', async () => {
      const subId = await connector.subscribeTrades();
      expect(subId).toBe('trades-sub-id');
    });

    it('should implement orders subscription', async () => {
      const subId = await connector.subscribeOrders();
      expect(subId).toBe('orders-sub-id');
    });

    it('should implement user orders subscription', async () => {
      const subId = await connector.subscribeUserOrders();
      expect(subId).toBe('user-orders-sub-id');
    });

    it('should implement user trades subscription', async () => {
      const subId = await connector.subscribeUserTrades();
      expect(subId).toBe('user-trades-sub-id');
    });

    it('should return correct websocket status', () => {
      expect(connector.getWebSocketStatus()).toBe('disconnected');
    });

    it('should return correct websocket connection state', () => {
      expect(connector.isWebSocketConnected()).toBe(false);
    });

    it('should return correct user data stream connection state', () => {
      expect(connector.isUserDataStreamConnected()).toBe(false);
    });
  });

  describe('method existence', () => {
    it('should have all required methods defined', () => {
      expect(typeof connector.connect).toBe('function');
      expect(typeof connector.disconnect).toBe('function');
      expect(typeof connector.getBalance).toBe('function');
      expect(typeof connector.createOrder).toBe('function');
      expect(typeof connector.cancelOrder).toBe('function');
      expect(typeof connector.getOrder).toBe('function');
      expect(typeof connector.getOpenOrders).toBe('function');
      expect(typeof connector.getTicker).toBe('function');
      expect(typeof connector.getOrderBook).toBe('function');
      expect(typeof connector.getRecentTrades).toBe('function');
      expect(typeof connector.connectWebSocket).toBe('function');
      expect(typeof connector.disconnectWebSocket).toBe('function');
      expect(typeof connector.subscribeTicker).toBe('function');
      expect(typeof connector.subscribeOrderBook).toBe('function');
      expect(typeof connector.subscribeTrades).toBe('function');
      expect(typeof connector.subscribeOrders).toBe('function');
      expect(typeof connector.unsubscribe).toBe('function');
      expect(typeof connector.isWebSocketConnected).toBe('function');
      expect(typeof connector.getWebSocketStatus).toBe('function');
      expect(typeof connector.connectUserDataStream).toBe('function');
      expect(typeof connector.disconnectUserDataStream).toBe('function');
      expect(typeof connector.subscribeUserOrders).toBe('function');
      expect(typeof connector.subscribeUserTrades).toBe('function');
      expect(typeof connector.isUserDataStreamConnected).toBe('function');
    });
  });
});
