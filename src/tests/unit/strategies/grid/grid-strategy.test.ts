import { GridStrategy } from '../../../../strategies/grid/grid-strategy';
import { BaseExchangeConnector } from '../../../../core/exchange/base-exchange-connector';
import {
  Balance,
  Order,
  OrderBook,
  OrderSide,
  OrderType,
  Ticker,
  Trade,
  WebSocketStatus,
  GridStrategyConfig,
} from '../../../../types';
jest.mock('../../../../core/price-aggregation/cardano-price-service');

class MockExchangeConnector extends BaseExchangeConnector {
  private mockBalance: Record<string, Balance> = {
    USDT: { asset: 'USDT', free: 1000, used: 0, total: 1000, available: 1000 },
  };
  private mockOrders: Order[] = [];
  private userOrderCallback?: (order: Order) => void;
  constructor() {
    super('test', 'Test Exchange');
  }
  async connect(): Promise<void> {
    this.connected = true;
  }
  async disconnect(): Promise<void> {
    this.connected = false;
  }
  async getBalance(): Promise<Record<string, Balance>> {
    return this.mockBalance;
  }
  async createOrder(
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price?: number
  ): Promise<Order> {
    const order: Order = {
      id: `order-${Date.now()}-${Math.random()}`,
      symbol,
      type,
      side,
      amount,
      price: price || 0,
      status: 'open',
      timestamp: Date.now(),
      filled: 0,
      remaining: amount,
    };
    this.mockOrders.push(order);
    return order;
  }
  async cancelOrder(orderId: string, symbol: string): Promise<void> {
    this.mockOrders = this.mockOrders.filter(o => o.id !== orderId);
  }
  async cancelAllOrders(symbol: string): Promise<void> {
    this.mockOrders = this.mockOrders.filter(o => o.symbol !== symbol);
  }
  async getOrder(orderId: string, symbol: string): Promise<Order> {
    const order = this.mockOrders.find(o => o.id === orderId && o.symbol === symbol);
    if (!order) throw new Error('Order not found');
    return order;
  }
  async getOpenOrders(symbol?: string): Promise<Order[]> {
    return symbol ? this.mockOrders.filter(o => o.symbol === symbol) : this.mockOrders;
  }
  async getTicker(symbol: string): Promise<Ticker> {
    return {
      symbol,
      bid: 100,
      ask: 101,
      last: 100.5,
      baseVolume: 1000,
      timestamp: Date.now(),
    };
  }
  async getOrderBook(symbol: string): Promise<OrderBook> {
    return {
      symbol,
      bids: [{ price: 100, amount: 10 }],
      asks: [{ price: 101, amount: 10 }],
      timestamp: Date.now(),
    };
  }
  async getRecentTrades(symbol: string): Promise<Trade[]> {
    return [];
  }
  async connectWebSocket(): Promise<void> {}
  async disconnectWebSocket(): Promise<void> {}
  async subscribeTicker(): Promise<string> {
    return 'ticker-sub';
  }
  async subscribeOrderBook(): Promise<string> {
    return 'orderbook-sub';
  }
  async subscribeTrades(): Promise<string> {
    return 'trades-sub';
  }
  async subscribeOrders(): Promise<string> {
    return 'orders-sub';
  }
  async unsubscribe(): Promise<void> {}
  isWebSocketConnected(): boolean {
    return false;
  }
  getWebSocketStatus(): WebSocketStatus {
    return 'disconnected';
  }
  async connectUserDataStream(): Promise<void> {}
  async disconnectUserDataStream(): Promise<void> {}
  async subscribeUserOrders(callback: (order: Order) => void): Promise<string> {
    this.userOrderCallback = callback;
    return 'user-orders-sub';
  }
  async subscribeUserTrades(): Promise<string> {
    return 'user-trades-sub';
  }
  isUserDataStreamConnected(): boolean {
    return true;
  }
  simulateOrderFill(orderId: string, fillAmount?: number): void {
    const order = this.mockOrders.find(o => o.id === orderId);
    if (order && this.userOrderCallback) {
      const filled = fillAmount || order.amount;
      const filledOrder = {
        ...order,
        status: filled >= order.amount ? 'filled' : 'partially_filled',
        filled,
        remaining: order.amount - filled,
      } as Order;
      this.userOrderCallback(filledOrder);
    }
  }
  getCreatedOrders(): Order[] {
    return [...this.mockOrders];
  }
}

describe('GridStrategy', () => {
  let strategy: GridStrategy;
  let mockExchange: MockExchangeConnector;
  const validConfig: GridStrategyConfig = {
    id: 'test-grid',
    type: 'grid',
    symbol: 'INDY/USDT',
    exchange: 'test',
    accountId: 'main',
    enabled: true,
    gridConfig: {
      symbol: 'INDY/USDT',
      gridLevels: 3,
      gridSpacing: 0.02,
      orderSize: 100,
      minConfidence: 0.6,
      priceDeviationThreshold: 0.015,
      adjustmentDebounce: 2000,
    },
    parameters: {
      gridLevels: 3,
      gridSpacing: 0.02,
      orderSize: 100,
      upperPrice: 999999,
      lowerPrice: 0,
    },
  };
  beforeEach(async () => {
    strategy = new GridStrategy('test-grid');
    mockExchange = new MockExchangeConnector();
    (strategy as any).priceService = {
      getTokenPrice: jest.fn().mockResolvedValue({
        price: 100,
        confidence: 0.8,
        sources: ['dex'],
      }),
    };
    strategy.setExchangeConnector(mockExchange);
    await mockExchange.connect();
    await strategy.initialize(validConfig);
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with valid config', async () => {
      expect(strategy.id).toBe('test-grid');
      expect(strategy.type).toBe('grid');
      expect(strategy.currentStatus).toBe('idle');
    });

    it('should throw error if config is invalid', async () => {
      const invalidConfig = { ...validConfig };
      delete (invalidConfig as any).gridConfig;
      await expect(strategy.initialize(invalidConfig as any)).rejects.toThrow();
    });
  });

  describe('start', () => {
    it('should start strategy and place initial grid', async () => {
      await strategy.start();
      expect(strategy.currentStatus).toBe('running');
      expect(mockExchange.getCreatedOrders().length).toBeGreaterThan(0);
    });

    it('should throw error if price confidence is too low', async () => {
      (strategy as any).priceService.getTokenPrice.mockResolvedValue({
        price: 100,
        confidence: 0.3,
        sources: ['dex'],
      });
      await expect(strategy.start()).rejects.toThrow(/Price confidence too low/);
    });

    it('should throw error if exchange connector not set', async () => {
      const strategyWithoutExchange = new GridStrategy('no-exchange');
      await strategyWithoutExchange.initialize(validConfig);
      await expect(strategyWithoutExchange.start()).rejects.toThrow(
        'Strategy not properly initialized'
      );
    });
  });

  describe('stop', () => {
    it('should stop strategy and cancel all orders', async () => {
      await strategy.start();
      const initialOrderCount = mockExchange.getCreatedOrders().length;
      expect(initialOrderCount).toBeGreaterThan(0);
      await strategy.stop();
      expect(strategy.currentStatus).toBe('stopped');
      expect(mockExchange.getCreatedOrders().length).toBeLessThan(initialOrderCount);
    });
  });

  describe('onOrderUpdate', () => {
    beforeEach(async () => {
      (strategy as any).priceService.getTokenPrice.mockResolvedValue({
        price: 100,
        confidence: 0.8,
        sources: ['dex'],
      });
      await strategy.start();
    });

    it('should handle filled orders by recreating grid', async () => {
      const firstOrder = mockExchange.getCreatedOrders()[0];
      mockExchange.simulateOrderFill(firstOrder.id, firstOrder.amount);
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(mockExchange.getCreatedOrders().length).toBeGreaterThan(0);
    });

    it('should handle partially filled orders by recreating grid', async () => {
      const firstOrder = mockExchange.getCreatedOrders()[0];
      mockExchange.simulateOrderFill(firstOrder.id, firstOrder.amount / 2);
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(mockExchange.getCreatedOrders().length).toBeGreaterThan(0);
    });

    it('should ignore orders from different symbols', async () => {
      const wrongSymbolOrder: Order = {
        id: 'wrong-symbol-order',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        amount: 1,
        price: 50000,
        status: 'filled',
        timestamp: Date.now(),
        filled: 1,
        remaining: 0,
      };
      const initialOrderCount = mockExchange.getCreatedOrders().length;
      await strategy.onOrderUpdate(wrongSymbolOrder);
      expect(mockExchange.getCreatedOrders().length).toBe(initialOrderCount);
    });
  });

  describe('onPriceUpdate', () => {
    beforeEach(async () => {
      (strategy as any).priceService.getTokenPrice.mockResolvedValue({
        price: 100,
        confidence: 0.8,
        sources: ['dex'],
      });
      await strategy.start();
    });

    it('should handle significant price deviations by recreating grid', async () => {
      await strategy.onPriceUpdate('INDY/USDT', 120);
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(mockExchange.getCreatedOrders().length).toBeGreaterThan(0);
    });

    it('should ignore small price changes within threshold', async () => {
      const initialOrderCount = mockExchange.getCreatedOrders().length;
      await strategy.onPriceUpdate('INDY/USDT', 101);
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(mockExchange.getCreatedOrders().length).toBe(initialOrderCount);
    });

    it('should ignore price updates for different symbols', async () => {
      const initialOrderCount = mockExchange.getCreatedOrders().length;
      await strategy.onPriceUpdate('BTC/USDT', 60000);
      expect(mockExchange.getCreatedOrders().length).toBe(initialOrderCount);
    });
  });

  describe('setExchangeConnector', () => {
    it('should set exchange connector', () => {
      const newStrategy = new GridStrategy('test');
      const newConnector = new MockExchangeConnector();
      newStrategy.setExchangeConnector(newConnector);
      expect(() => newStrategy.setExchangeConnector(newConnector)).not.toThrow();
    });
  });

  describe('WebSocket integration', () => {
    it('should set up user data stream subscription on start', async () => {
      const connectSpy = jest.spyOn(mockExchange, 'connectUserDataStream');
      const subscribeSpy = jest.spyOn(mockExchange, 'subscribeUserOrders');
      (strategy as any).priceService.getTokenPrice.mockResolvedValue({
        price: 100,
        confidence: 0.8,
        sources: ['dex'],
      });
      await strategy.start();
      expect(connectSpy).toHaveBeenCalled();
      expect(subscribeSpy).toHaveBeenCalled();
    });

    it('should handle bulk order cancellation', async () => {
      const cancelAllSpy = jest.spyOn(mockExchange, 'cancelAllOrders');
      (strategy as any).priceService.getTokenPrice.mockResolvedValue({
        price: 100,
        confidence: 0.8,
        sources: ['dex'],
      });
      await strategy.start();
      const firstOrder = mockExchange.getCreatedOrders()[0];
      mockExchange.simulateOrderFill(firstOrder.id, firstOrder.amount);
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(cancelAllSpy).toHaveBeenCalledWith('INDY/USDT');
    });
  });

  describe('Edge Cases', () => {
    describe('initialization edge cases', () => {
      it('should handle initialization with minimal config', async () => {
        const newStrategy = new GridStrategy('minimal-test');
        const minimalConfig: GridStrategyConfig = {
          ...validConfig,
          id: 'minimal-test',
          gridConfig: {
            symbol: 'TEST/USDT',
            gridLevels: 1,
            gridSpacing: 0.01,
            orderSize: 10,
            minConfidence: 0.1,
            priceDeviationThreshold: 0.001,
            adjustmentDebounce: 100,
          },
        };
        newStrategy.setExchangeConnector(mockExchange);
        await mockExchange.connect();
        await expect(newStrategy.initialize(minimalConfig)).resolves.not.toThrow();
        expect(newStrategy.currentStatus).toBe('idle');
      });
    });

    describe('start edge cases', () => {
      it('should handle price service failure', async () => {
        (strategy as any).priceService.getTokenPrice.mockRejectedValue(
          new Error('Price service unavailable')
        );
        await expect(strategy.start()).rejects.toThrow('Price service unavailable');
      });

      it('should handle balance retrieval failure', async () => {
        (strategy as any).priceService.getTokenPrice.mockResolvedValue({
          price: 100,
          confidence: 0.8,
          sources: ['dex'],
        });
        const originalGetBalance = mockExchange.getBalance;
        mockExchange.getBalance = jest.fn().mockRejectedValue(new Error('Balance unavailable'));
        await expect(strategy.start()).rejects.toThrow('Balance unavailable');
        mockExchange.getBalance = originalGetBalance;
      });

      it('should handle user data stream connection failure gracefully', async () => {
        (strategy as any).priceService.getTokenPrice.mockResolvedValue({
          price: 100,
          confidence: 0.8,
          sources: ['dex'],
        });
        const originalConnect = mockExchange.connectUserDataStream;
        mockExchange.connectUserDataStream = jest
          .fn()
          .mockRejectedValue(new Error('Stream connection failed'));
        await expect(strategy.start()).resolves.not.toThrow();
        expect(strategy.currentStatus).toBe('running');
        mockExchange.connectUserDataStream = originalConnect;
      });
    });

    describe('stop edge cases', () => {
      it('should handle stop when exchange connector is missing', async () => {
        const strategyWithoutExchange = new GridStrategy('no-exchange-stop');
        await strategyWithoutExchange.initialize(validConfig);
        await expect(strategyWithoutExchange.stop()).resolves.not.toThrow();
        expect(strategyWithoutExchange.currentStatus).toBe('stopped');
      });

      it('should handle order cancellation failures during stop', async () => {
        await strategy.start();
        const originalCancel = mockExchange.cancelAllOrders;
        mockExchange.cancelAllOrders = jest.fn().mockRejectedValue(new Error('Cancel failed'));
        await expect(strategy.stop()).resolves.not.toThrow();
        expect(strategy.currentStatus).toBe('stopped');
        mockExchange.cancelAllOrders = originalCancel;
      });
    });

    describe('error handling', () => {
      it('should handle price updates when gridConfig is missing', async () => {
        (strategy as any).gridConfig = undefined;
        await expect(strategy.onPriceUpdate('INDY/USDT', 1.0)).resolves.not.toThrow();
      });

      it('should handle balance retrieval failure in price update', async () => {
        const originalGetBalance = mockExchange.getBalance;
        mockExchange.getBalance = jest.fn().mockRejectedValue(new Error('Balance error'));
        await expect(strategy.onPriceUpdate('INDY/USDT', 1.0)).resolves.not.toThrow();
        mockExchange.getBalance = originalGetBalance;
      });

      it('should handle non-filled order updates correctly', async () => {
        const order: Order = {
          id: 'order-1',
          symbol: 'INDY/USDT',
          type: 'limit',
          side: 'buy',
          amount: 100,
          price: 1.0,
          filled: 0,
          remaining: 100,
          status: 'open',
          timestamp: Date.now(),
        };
        const initialOrderCount = mockExchange.getCreatedOrders().length;
        await strategy.onOrderUpdate(order);
        expect(mockExchange.getCreatedOrders().length).toBe(initialOrderCount);
      });

      it('should throw error when quote asset balance is not found', async () => {
        const originalGetBalance = mockExchange.getBalance;
        mockExchange.getBalance = jest.fn().mockResolvedValue({
          BTC: { asset: 'BTC', free: 1, used: 0, total: 1, available: 1 },
        });
        await expect((strategy as any).getAvailableBalance()).rejects.toThrow(
          'No balance found for USDT'
        );
        mockExchange.getBalance = originalGetBalance;
      });
    });

    describe('setRiskConfig', () => {
      it('should allow setting risk configuration', () => {
        const newRiskConfig = {
          maxPositionSize: 0.9,
          safetyReservePercentage: 0.1,
          minConfidence: 0.7,
        };
        expect(() => strategy.setRiskConfig(newRiskConfig)).not.toThrow();
      });
    });

    describe('complex symbol parsing', () => {
      it('should handle complex symbol formats', async () => {
        const complexStrategy = new GridStrategy('complex-symbol');
        const complexConfig = {
          ...validConfig,
          id: 'complex-symbol',
          symbol: 'BTC/USDT',
          gridConfig: {
            ...validConfig.gridConfig,
            symbol: 'BTC/USDT',
          },
        };
        complexStrategy.setExchangeConnector(mockExchange);
        await mockExchange.connect();
        await complexStrategy.initialize(complexConfig);
        const result = await (complexStrategy as any).getAvailableBalance();
        expect(typeof result).toBe('number');
      });
    });
  });
});
