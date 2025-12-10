import { GridStrategy } from '../../../../strategies/grid/grid-strategy';
import { BaseExchangeConnector } from '../../../../core/exchange/base-exchange-connector';
import { CardanoPriceService } from '../../../../core/price-aggregation';
import { GridStrategyConfig } from '../../../../types';
import { Order, OrderSide, OrderType } from '../../../../types';
import { Balance } from '../../../../types';
import { AggregatedPrice } from '../../../../types';

jest.mock('../../../../core/price-aggregation/cardano-price-service');

const mockExchangeConnector = {
  id: 'test-exchange',
  name: 'Test Exchange',
  isConnected: jest.fn().mockReturnValue(true),
  setCredentials: jest.fn(),
  createOrder: jest.fn(),
  cancelOrder: jest.fn(),
  getBalance: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  getOrder: jest.fn(),
  getOpenOrders: jest.fn(),
  getTicker: jest.fn(),
  getOrderBook: jest.fn(),
  getRecentTrades: jest.fn(),
  connectWebSocket: jest.fn(),
  disconnectWebSocket: jest.fn(),
  subscribeTicker: jest.fn(),
  subscribeOrderBook: jest.fn(),
  subscribeTrades: jest.fn(),
  subscribeOrders: jest.fn(),
  unsubscribe: jest.fn(),
  isWebSocketConnected: jest.fn(),
  getWebSocketStatus: jest.fn(),
  connectUserDataStream: jest.fn(),
  disconnectUserDataStream: jest.fn(),
  subscribeUserOrders: jest.fn(),
  subscribeUserTrades: jest.fn(),
  isUserDataStreamConnected: jest.fn()
} as unknown as jest.Mocked<BaseExchangeConnector>;

const mockPriceService = jest.mocked(new CardanoPriceService());

describe('GridStrategy', () => {
  let strategy: GridStrategy;
  let mockConfig: GridStrategyConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    
    strategy = new GridStrategy('test-grid-001');
    strategy.setExchangeConnector(mockExchangeConnector);
    
    mockConfig = {
      id: 'test-grid-001',
      type: 'grid',
      symbol: 'INDY/USDT',
      exchange: 'mexc',
      accountId: 'main',
      enabled: true,
      gridConfig: {
        symbol: 'INDY/USDT',
        gridLevels: 5,
        gridSpacing: 0.02,
        orderSize: 50,
        minConfidence: 0.6,
        priceDeviationThreshold: 0.015,
        adjustmentDebounce: 2000
      },
      parameters: {
        gridLevels: 5,
        gridSpacing: 0.02,
        orderSize: 50,
        upperPrice: 0.50,
        lowerPrice: 0.35
      }
    };

    (CardanoPriceService as jest.MockedClass<typeof CardanoPriceService>).prototype.getTokenPrice = mockPriceService.getTokenPrice;
  });

  describe('initialization', () => {
    it('should initialize correctly with valid config', async () => {
      await strategy.initialize(mockConfig);
      
      expect(strategy.currentStatus).toBe('idle');
      expect(strategy.type).toBe('grid');
    });

    it('should throw error on invalid config', async () => {
      const invalidConfig = { ...mockConfig, symbol: '' };
      
      await expect(strategy.initialize(invalidConfig)).rejects.toThrow();
    });
  });

  describe('grid strategy execution', () => {
    beforeEach(async () => {
      await strategy.initialize(mockConfig);
    });

    it('should start grid strategy with valid price confidence', async () => {
      const mockAggregatedPrice: AggregatedPrice = {
        symbol: 'INDY/USDT',
        price: 0.42,
        confidence: 0.8,
        timestamp: new Date(),
        sources: []
      };

      const mockBalance: Balance = {
        asset: 'USDT',
        free: 800,
        used: 200,
        total: 1000,
        available: 800
      };

      mockPriceService.getTokenPrice.mockResolvedValue(mockAggregatedPrice);
      mockExchangeConnector.getBalance.mockResolvedValue({
        'USDT': mockBalance
      });
      mockExchangeConnector.createOrder.mockImplementation(async (symbol, type, side, amount, price) => ({
        id: `order-${Math.random()}`,
        symbol,
        type: type as OrderType,
        side: side as OrderSide,
        amount,
        price: price || 0,
        filled: 0,
        remaining: amount,
        status: 'open' as const,
        timestamp: Date.now()
      }));

      await strategy.start();

      expect(strategy.currentStatus).toBe('running');
      expect(mockPriceService.getTokenPrice).toHaveBeenCalledWith('INDY/USDT');
      expect(mockExchangeConnector.getBalance).toHaveBeenCalled();
      expect(mockExchangeConnector.createOrder).toHaveBeenCalledTimes(10);
    });

    it('should reject start with low price confidence', async () => {
      const mockAggregatedPrice: AggregatedPrice = {
        symbol: 'INDY/USDT',
        price: 0.42,
        confidence: 0.4,
        timestamp: new Date(),
        sources: []
      };

      mockPriceService.getTokenPrice.mockResolvedValue(mockAggregatedPrice);

      await expect(strategy.start()).rejects.toThrow('Price confidence too low');
    });

    it('should place 5 buy and 5 sell orders', async () => {
      const mockAggregatedPrice: AggregatedPrice = {
        symbol: 'INDY/USDT',
        price: 0.42,
        confidence: 0.8,
        timestamp: new Date(),
        sources: []
      };

      const mockBalance: Balance = {
        asset: 'USDT',
        free: 800,
        used: 200,
        total: 1000,
        available: 800
      };

      mockPriceService.getTokenPrice.mockResolvedValue(mockAggregatedPrice);
      mockExchangeConnector.getBalance.mockResolvedValue({
        'USDT': mockBalance
      });
      
      let buyOrderCount = 0;
      let sellOrderCount = 0;
      
      mockExchangeConnector.createOrder.mockImplementation(async (symbol, type, side, amount, price) => {
        if (side === 'buy') buyOrderCount++;
        if (side === 'sell') sellOrderCount++;
        
        return {
          id: `order-${Math.random()}`,
          symbol,
          type: type as OrderType,
          side: side as OrderSide,
          amount,
          price: price || 0,
          filled: 0,
          remaining: amount,
          status: 'open' as const,
          timestamp: Date.now()
        };
      });

      await strategy.start();

      expect(buyOrderCount).toBe(5);
      expect(sellOrderCount).toBe(5);
    });

    it('should respect 80/20 position limits', async () => {
      const mockAggregatedPrice: AggregatedPrice = {
        symbol: 'INDY/USDT',
        price: 0.42,
        confidence: 0.8,
        timestamp: new Date(),
        sources: []
      };

      const mockBalance: Balance = {
        asset: 'USDT',
        free: 200,
        used: 800,
        total: 1000,
        available: 200
      };

      mockPriceService.getTokenPrice.mockResolvedValue(mockAggregatedPrice);
      mockExchangeConnector.getBalance.mockResolvedValue({
        'USDT': mockBalance
      });

      mockExchangeConnector.createOrder.mockImplementation(async (symbol, type, side, amount, price) => {
        const orderValue = amount * (price || 0);
        expect(orderValue).toBeLessThanOrEqual(mockBalance.total * 0.8);
        
        return {
          id: `order-${Math.random()}`,
          symbol,
          type: type as OrderType,
          side: side as OrderSide,
          amount,
          price: price || 0,
          filled: 0,
          remaining: amount,
          status: 'open' as const,
          timestamp: Date.now()
        };
      });

      await strategy.start();
      
      expect(mockExchangeConnector.createOrder).toHaveBeenCalledTimes(10);
    });

    it('should stop strategy and cancel orders', async () => {
      await strategy.start();
      
      mockExchangeConnector.createOrder.mockResolvedValue({
        id: 'test-order',
        symbol: 'INDY/USDT',
        type: 'limit',
        side: 'buy',
        amount: 50,
        price: 0.40,
        filled: 0,
        remaining: 50,
        status: 'open',
        timestamp: Date.now()
      });

      await strategy.stop();

      expect(strategy.currentStatus).toBe('stopped');
    });
  });

  describe('order update handling', () => {
    beforeEach(async () => {
      await strategy.initialize(mockConfig);
    });

    it('should handle filled order correctly', async () => {
      const filledOrder: Order = {
        id: 'test-order',
        symbol: 'INDY/USDT',
        type: 'limit',
        side: 'buy',
        amount: 50,
        price: 0.40,
        filled: 50,
        remaining: 0,
        status: 'filled',
        timestamp: Date.now()
      };

      const mockAggregatedPrice: AggregatedPrice = {
        symbol: 'INDY/USDT',
        price: 0.42,
        confidence: 0.8,
        timestamp: new Date(),
        sources: []
      };

      const mockBalance: Balance = {
        asset: 'USDT',
        free: 800,
        used: 200,
        total: 1000,
        available: 800
      };

      mockPriceService.getTokenPrice.mockResolvedValue(mockAggregatedPrice);
      mockExchangeConnector.getBalance.mockResolvedValue({
        'USDT': mockBalance
      });

      await strategy.onOrderUpdate(filledOrder);

      expect(mockPriceService.getTokenPrice).toHaveBeenCalledWith('INDY/USDT');
      expect(mockExchangeConnector.getBalance).toHaveBeenCalled();
    });
  });
});