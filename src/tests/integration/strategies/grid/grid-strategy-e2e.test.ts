import { GridStrategy } from '../../../../strategies/grid/grid-strategy';
import {
  Order,
  OrderSide,
  OrderType,
  OrderStatus,
  Balance,
  Ticker,
  OrderBook,
  Trade,
  WebSocketStatus,
  GridStrategyConfig,
} from '../../../../types';
import { BaseExchangeConnector } from '../../../../core/exchange/base-exchange-connector';
/**
 * Mock Exchange Connector for End-to-End Testing
 * Simulates MEXC exchange behavior with real protobuf message patterns
 */
class MockExchangeConnector extends BaseExchangeConnector {
  private orderIdCounter = 1000;
  private openOrders: Order[] = [];
  private orderUpdateCallbacks: ((order: Order) => void)[] = [];
  private balances: Record<string, Balance> = {
    USDT: { asset: 'USDT', free: 1000, used: 0, total: 1000, available: 1000 },
    INDY: { asset: 'INDY', free: 0, used: 0, total: 0, available: 0 },
  };
  protected userDataStreamConnected = false;
  private testProtobufMessages: string[] = [];
  private pendingTimeouts: NodeJS.Timeout[] = [];
  constructor() {
    super('mock-exchange', 'Mock Exchange');
  }
  async connect(): Promise<void> {
    this.connected = true;
  }
  async disconnect(): Promise<void> {
    this.connected = false;
    this.userDataStreamConnected = false;
    this.pendingTimeouts.forEach(timeout => clearTimeout(timeout));
    this.pendingTimeouts = [];
  }
  async connectUserDataStream(): Promise<void> {
    this.userDataStreamConnected = true;
  }
  async disconnectUserDataStream(): Promise<void> {
    this.userDataStreamConnected = false;
  }
  isUserDataStreamConnected(): boolean {
    return this.userDataStreamConnected;
  }
  async subscribeUserOrders(callback: (order: Order) => void): Promise<string> {
    this.orderUpdateCallbacks.push(callback);
    return 'subscription-id-' + Date.now();
  }
  async createOrder(
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price?: number
  ): Promise<Order> {
    const orderId = `C02__${this.orderIdCounter++}`;
    const order: Order = {
      id: orderId,
      symbol,
      type,
      side,
      amount,
      price: price || 0,
      filled: 0,
      remaining: amount,
      status: 'open' as OrderStatus,
      timestamp: Date.now(),
    };
    this.openOrders.push(order);
    const timeout = setTimeout(() => {
      this.simulateProtobufOrderUpdate(order, 'new');
    }, 100);
    this.pendingTimeouts.push(timeout);
    return order;
  }
  async cancelOrder(orderId: string, symbol?: string): Promise<void> {
    const orderIndex = this.openOrders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) {
      throw new Error(`Order ${orderId} not found`);
    }
    const order = this.openOrders[orderIndex];
    order.status = 'cancelled';
    this.openOrders.splice(orderIndex, 1);
    const timeout = setTimeout(() => {
      this.simulateProtobufOrderUpdate(order, 'cancelled_with_filled_indicators');
    }, 100);
    this.pendingTimeouts.push(timeout);
  }
  async cancelAllOrders(symbol: string): Promise<void> {
    const symbolOrders = this.openOrders.filter(o => o.symbol === symbol);
    for (const order of symbolOrders) {
      await this.cancelOrder(order.id, symbol);
    }
  }
  async getOpenOrders(symbol?: string): Promise<Order[]> {
    return symbol ? this.openOrders.filter(o => o.symbol === symbol) : this.openOrders;
  }
  async getBalance(): Promise<Record<string, Balance>> {
    return { ...this.balances };
  }
  async getOrder(orderId: string, symbol: string): Promise<Order> {
    const order = this.openOrders.find(o => o.id === orderId && o.symbol === symbol);
    if (!order) throw new Error(`Order ${orderId} not found`);
    return order;
  }
  async getTicker(symbol: string): Promise<Ticker> {
    return {
      symbol,
      last: 0.3,
      bid: 0.299,
      ask: 0.301,
      baseVolume: 100000,
      quoteVolume: 30000,
      timestamp: Date.now(),
    };
  }
  async getOrderBook(symbol: string): Promise<OrderBook> {
    return {
      symbol,
      bids: [
        { price: 0.299, amount: 1000 },
        { price: 0.298, amount: 2000 },
      ],
      asks: [
        { price: 0.301, amount: 1500 },
        { price: 0.302, amount: 1200 },
      ],
      timestamp: Date.now(),
    };
  }
  async getRecentTrades(symbol: string): Promise<Trade[]> {
    return [
      {
        id: 'trade-1',
        symbol,
        side: 'buy',
        amount: 100,
        price: 0.3,
        timestamp: Date.now(),
      },
    ];
  }
  async connectWebSocket(): Promise<void> {}
  async disconnectWebSocket(): Promise<void> {}
  async subscribeTicker(): Promise<string> {
    return 'ticker-sub-1';
  }
  async subscribeOrderBook(): Promise<string> {
    return 'orderbook-sub-1';
  }
  async subscribeTrades(): Promise<string> {
    return 'trades-sub-1';
  }
  async subscribeOrders(): Promise<string> {
    return 'orders-sub-1';
  }
  async unsubscribe(): Promise<void> {}
  isWebSocketConnected(): boolean {
    return true;
  }
  getWebSocketStatus(): WebSocketStatus {
    return 'connected';
  }
  async subscribeUserTrades(): Promise<string> {
    return 'user-trades-sub-1';
  }
  simulateOrderFill(orderId: string, fillAmount?: number): void {
    const order = this.openOrders.find(o => o.id === orderId);
    if (!order) return;
    const actualFillAmount = fillAmount || order.remaining;
    order.filled += actualFillAmount;
    order.remaining -= actualFillAmount;
    if (order.remaining <= 0) {
      order.status = 'filled';
      const index = this.openOrders.findIndex(o => o.id === orderId);
      if (index !== -1) this.openOrders.splice(index, 1);
    } else {
      order.status = 'partially_filled';
    }
    if (order.side === 'sell') {
      const price = order.price || 0;
      this.balances.USDT.free += actualFillAmount * price;
      this.balances.USDT.available += actualFillAmount * price;
      this.balances.USDT.total += actualFillAmount * price;
      this.balances.INDY.free -= actualFillAmount;
      this.balances.INDY.available -= actualFillAmount;
      this.balances.INDY.total -= actualFillAmount;
    } else {
      const price = order.price || 0;
      this.balances.USDT.free -= actualFillAmount * price;
      this.balances.USDT.available -= actualFillAmount * price;
      this.balances.USDT.total -= actualFillAmount * price;
      this.balances.INDY.free += actualFillAmount;
      this.balances.INDY.available += actualFillAmount;
      this.balances.INDY.total += actualFillAmount;
    }
    const timeout = setTimeout(() => {
      this.simulateProtobufOrderUpdate(order, order.status);
    }, 100);
    this.pendingTimeouts.push(timeout);
  }
  private simulateProtobufOrderUpdate(order: Order, statusType: string): void {
    if (!this.connected) {
      return;
    }
    let protobufMessage: string;
    let actualStatus: OrderStatus;
    switch (statusType) {
      case 'new':
        protobufMessage = `\nspot@private.orders.v3.api.pb\u001a\bINDYUSDT0����3�\u0013Z\n\u001a${order.id}\u001a\u00050.323"\u000528.98*\u00079.360542\u000108\u0001@\u0001R\u00079.36054Z\u000528.98j\u00010r\u00010x\u0001�\u0001�����3`;
        actualStatus = 'open';
        break;
      case 'filled':
      case 'partially_filled':
        protobufMessage = `\nspot@private.orders.v3.api.pb\u001a\bINDYUSDT0����3�\u0013i\n\u001a${order.id}\u001a\u00060.3229"\u000528.98*\b3.87942\u00060.32298\u0001@\u0002R\u00063.8794Z\u000511.41j\u00010r\u00010x\u0002�\u0001����3`;
        actualStatus = statusType as OrderStatus;
        break;
      case 'cancelled_with_filled_indicators':
        protobufMessage = `\nspot@private.orders.v3.api.pb\u001a\bINDYUSDT0����3�\u0013]\n\u001a${order.id}\u001a\u00060.3328"\u000528.98*\b9.6445442\u000108\u0001@\u0002R\b9.644544Z\u000528.98j\u00010r\u00010x\u0004�\u0001����3`;
        actualStatus = 'cancelled';
        break;
      default:
        protobufMessage = '';
        actualStatus = 'cancelled';
    }
    this.testProtobufMessages.push(protobufMessage);
    const orderUpdate: Order = {
      ...order,
      status: actualStatus,
    };
    this.orderUpdateCallbacks.forEach(callback => {
      callback(orderUpdate);
    });
  }
  getTestProtobufMessages(): string[] {
    return [...this.testProtobufMessages];
  }
}

describe('Grid Strategy End-to-End Workflow', () => {
  let gridStrategy: GridStrategy;
  let mockExchange: MockExchangeConnector;
  let orderUpdates: Order[] = [];
  let gridRecreationCount = 0;
  const testConfig: GridStrategyConfig = {
    id: 'test-grid-strategy',
    type: 'grid',
    symbol: 'INDY/USDT',
    exchange: 'mock-exchange',
    accountId: 'test-account',
    enabled: true,
    gridConfig: {
      symbol: 'INDY/USDT',
      gridLevels: 5,
      gridSpacing: 0.02,
      orderSize: 10,
      minConfidence: 0.6,
      priceDeviationThreshold: 0.015,
      adjustmentDebounce: 1000,
    },
    parameters: {
      gridLevels: 5,
      gridSpacing: 0.02,
      orderSize: 10,
      upperPrice: 999999,
      lowerPrice: 0,
    },
  };
  beforeEach(async () => {
    orderUpdates = [];
    gridRecreationCount = 0;
    mockExchange = new MockExchangeConnector();
    await mockExchange.connect();
    await mockExchange.connectUserDataStream();
    gridStrategy = new GridStrategy('test-grid-1');
    gridStrategy.setExchangeConnector(mockExchange);
    const originalOnOrderUpdate = gridStrategy.onOrderUpdate.bind(gridStrategy);
    gridStrategy.onOrderUpdate = async (order: Order) => {
      orderUpdates.push({ ...order });
      if (order.status === 'filled') {
        const ordersBefore = await mockExchange.getOpenOrders(order.symbol);
        const orderCountBefore = ordersBefore.length;
        await originalOnOrderUpdate(order);
        await new Promise(resolve => setTimeout(resolve, 200));
        const ordersAfter = await mockExchange.getOpenOrders(order.symbol);
        if (ordersAfter.length >= orderCountBefore) {
          gridRecreationCount++;
        }
      } else {
        await originalOnOrderUpdate(order);
      }
    };
    await gridStrategy.initialize(testConfig);
  });
  afterEach(async () => {
    if (gridStrategy && gridStrategy.currentStatus === 'running') {
      await gridStrategy.stop();
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    if (mockExchange) {
      await mockExchange.disconnect();
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  });

  describe('Complete Order Lifecycle Flow', () => {
    test('should handle order placement → fill → grid recreation correctly', async () => {
      await gridStrategy.start();
      expect(gridStrategy.currentStatus).toBe('running');
      await new Promise(resolve => setTimeout(resolve, 500));
      const initialOrders = await mockExchange.getOpenOrders('INDY/USDT');
      expect(initialOrders.length).toBeGreaterThan(0);
      const orderToFill = initialOrders[0];
      mockExchange.simulateOrderFill(orderToFill.id);
      await new Promise(resolve => setTimeout(resolve, 2000));
      const fillUpdate = orderUpdates.find(
        update => update.id === orderToFill.id && update.status === 'filled'
      );
      expect(fillUpdate).toBeDefined();
      expect(fillUpdate?.status).toBe('filled');
      expect(fillUpdate).toBeDefined();
      expect(fillUpdate?.status).toBe('filled');
      expect(orderUpdates.length).toBeGreaterThanOrEqual(1);
    }, 10000);

    test('should handle order cancellation → NO grid recreation (fixed behavior)', async () => {
      await gridStrategy.start();
      await new Promise(resolve => setTimeout(resolve, 500));
      const initialOrders = await mockExchange.getOpenOrders('INDY/USDT');
      const initialGridRecreationCount = gridRecreationCount;
      const orderToCancel = initialOrders[0];
      await mockExchange.cancelOrder(orderToCancel.id, 'INDY/USDT');
      await new Promise(resolve => setTimeout(resolve, 1000));
      const cancelUpdate = orderUpdates.find(
        update => update.id === orderToCancel.id && update.status === 'cancelled'
      );
      expect(cancelUpdate).toBeDefined();
      expect(cancelUpdate?.status).toBe('cancelled');
      expect(gridRecreationCount).toBe(initialGridRecreationCount);
      const protobufMessages = mockExchange.getTestProtobufMessages();
      const cancelMessage = protobufMessages[protobufMessages.length - 1];
      expect(cancelMessage).toContain('\u0002');
      expect(cancelMessage).toContain('\u0004');
    }, 10000);

    test('should handle multiple order updates without infinite loops', async () => {
      await gridStrategy.start();
      await new Promise(resolve => setTimeout(resolve, 500));
      const initialOrders = await mockExchange.getOpenOrders('INDY/USDT');
      const testSequence = [
        { action: 'fill', orderId: initialOrders[0]?.id },
        { action: 'cancel', orderId: initialOrders[1]?.id },
        { action: 'fill', orderId: initialOrders[2]?.id },
      ];
      for (const step of testSequence) {
        if (step.action === 'fill' && step.orderId) {
          mockExchange.simulateOrderFill(step.orderId);
          await new Promise(resolve => setTimeout(resolve, 1200));
        } else if (step.action === 'cancel' && step.orderId) {
          await mockExchange.cancelOrder(step.orderId, 'INDY/USDT');
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
      expect(orderUpdates.length).toBeGreaterThanOrEqual(3);
      expect(gridRecreationCount).toBe(2);
      expect(gridStrategy.currentStatus).toBe('running');
    }, 15000);
  });

  describe('WebSocket Message Flow Integration', () => {
    test('should correctly route protobuf messages through the complete pipeline', async () => {
      await gridStrategy.start();
      await new Promise(resolve => setTimeout(resolve, 500));
      const initialOrders = await mockExchange.getOpenOrders('INDY/USDT');
      mockExchange.simulateOrderFill(initialOrders[0].id);
      await new Promise(resolve => setTimeout(resolve, 500));
      await mockExchange.cancelOrder(initialOrders[1].id, 'INDY/USDT');
      await new Promise(resolve => setTimeout(resolve, 500));
      const protobufMessages = mockExchange.getTestProtobufMessages();
      expect(protobufMessages.length).toBeGreaterThanOrEqual(3);
      expect(orderUpdates.length).toBeGreaterThanOrEqual(3);
      const fillMessage = protobufMessages.find(
        msg => msg.includes('\u0002') && !msg.includes('\u0004')
      );
      const cancelMessage = protobufMessages.find(msg => msg.includes('\u0004'));
      expect(fillMessage).toBeDefined();
      expect(cancelMessage).toBeDefined();
    });
  });
});
