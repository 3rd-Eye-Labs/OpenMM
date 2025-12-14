import { GridOrderManager } from '../../../../strategies/grid/grid-order-manager';
import { Order, GridLevel } from '../../../../types';

describe('GridOrderManager', () => {
  let manager: GridOrderManager;
  let mockPlaceOrder: jest.Mock;
  let mockCancelAllOrders: jest.Mock;
  beforeEach(() => {
    jest.useFakeTimers();
    manager = new GridOrderManager({
      priceDeviationThreshold: 0.02,
      adjustmentDebounce: 1000
    });
    mockPlaceOrder = jest.fn();
    mockCancelAllOrders = jest.fn();
    jest.clearAllMocks();
  });
  afterEach(async () => {
    if (manager && typeof (manager as any).cleanup === 'function') {
      await (manager as any).cleanup();
    }
    jest.clearAllTimers();
    jest.runOnlyPendingTimers();
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  describe('placeInitialGrid', () => {
    it('should place orders for all grid levels', async () => {
      const levels: GridLevel[] = [
        { price: 100, side: 'buy', orderSize: 10 },
        { price: 110, side: 'sell', orderSize: 10 }
      ];
      const mockOrder: Order = {
        id: 'test-order',
        symbol: 'INDY/USDT',
        type: 'limit',
        side: 'buy',
        amount: 10,
        price: 100,
        status: 'open',
        timestamp: Date.now(),
        filled: 0,
        remaining: 10
      };
      mockPlaceOrder.mockResolvedValue(mockOrder);
      const orders = await manager.placeInitialGrid(levels, mockPlaceOrder);
      expect(mockPlaceOrder).toHaveBeenCalledTimes(2);
      expect(mockPlaceOrder).toHaveBeenCalledWith('buy', 10, 100);
      expect(mockPlaceOrder).toHaveBeenCalledWith('sell', 10, 110);
      expect(orders).toHaveLength(2);
      expect(manager.getActiveOrders()).toHaveLength(2);
    });

    it('should handle order placement failures gracefully', async () => {
      const levels: GridLevel[] = [
        { price: 100, side: 'buy', orderSize: 10 },
        { price: 110, side: 'sell', orderSize: 10 }
      ];
      const mockOrder: Order = {
        id: 'test-order',
        symbol: 'INDY/USDT',
        type: 'limit',
        side: 'sell',
        amount: 10,
        price: 110,
        status: 'open',
        timestamp: Date.now(),
        filled: 0,
        remaining: 10
      };
      mockPlaceOrder
        .mockRejectedValueOnce(new Error('Insufficient balance'))
        .mockResolvedValueOnce(mockOrder);
      const orders = await manager.placeInitialGrid(levels, mockPlaceOrder);
      expect(mockPlaceOrder).toHaveBeenCalledTimes(2);
      expect(orders).toHaveLength(1);
      expect(manager.getActiveOrders()).toHaveLength(1);
    });
  });

  describe('handleOrderFill', () => {
    it('should recreate grid after order fill with debounce', async () => {
      const initialOrder: Order = {
        id: 'initial-order',
        symbol: 'INDY/USDT',
        type: 'limit',
        side: 'sell',
        amount: 5,
        price: 110,
        status: 'open',
        timestamp: Date.now(),
        filled: 0,
        remaining: 5
      };
      const mockInitialPlaceOrder = jest.fn().mockResolvedValue(initialOrder);
      await manager.placeInitialGrid([
        { side: 'sell', price: 110, orderSize: 5 }
      ], mockInitialPlaceOrder);
      const filledOrder: Order = {
        id: 'filled-order',
        symbol: 'INDY/USDT',
        type: 'limit',
        side: 'buy',
        amount: 10,
        price: 100,
        status: 'filled',
        timestamp: Date.now(),
        filled: 10,
        remaining: 0
      };
      mockCancelAllOrders.mockResolvedValue(undefined);
      mockPlaceOrder.mockResolvedValue({
        id: 'new-order',
        symbol: 'INDY/USDT',
        type: 'limit',
        side: 'buy',
        amount: 5,
        price: 105,
        status: 'open',
        timestamp: Date.now(),
        filled: 0,
        remaining: 5
      });
      await manager.handleOrderFill(
        filledOrder,
        105,
        0.02,
        3,
        100,
        mockPlaceOrder,
        mockCancelAllOrders
      );
      expect(mockCancelAllOrders).toHaveBeenCalledWith('INDY/USDT');
      expect(mockPlaceOrder).toHaveBeenCalled();
    });

    it('should respect debounce and not recreate grid if called too quickly', async () => {
      const filledOrder: Order = {
        id: 'filled-order',
        symbol: 'INDY/USDT',
        type: 'limit',
        side: 'buy',
        amount: 10,
        price: 100,
        status: 'filled',
        timestamp: Date.now(),
        filled: 10,
        remaining: 0
      };
      await manager.handleOrderFill(
        filledOrder,
        105,
        0.02,
        3,
        100,
        mockPlaceOrder,
        mockCancelAllOrders
      );
      mockCancelAllOrders.mockClear();
      mockPlaceOrder.mockClear();
      await manager.handleOrderFill(
        filledOrder,
        106,
        0.02,
        3,
        100,
        mockPlaceOrder,
        mockCancelAllOrders
      );
      expect(mockCancelAllOrders).not.toHaveBeenCalled();
      expect(mockPlaceOrder).not.toHaveBeenCalled();
    });
  });

  describe('handlePriceDeviation', () => {
    beforeEach(() => {
      const levels: GridLevel[] = [
        { price: 100, side: 'buy', orderSize: 10 },
        { price: 110, side: 'sell', orderSize: 10 }
      ];
      const mockOrder: Order = {
        id: 'test-order',
        symbol: 'INDY/USDT',
        type: 'limit',
        side: 'buy',
        amount: 10,
        price: 100,
        status: 'open',
        timestamp: Date.now(),
        filled: 0,
        remaining: 10
      };
      mockPlaceOrder.mockResolvedValue(mockOrder);
      return manager.placeInitialGrid(levels, mockPlaceOrder);
    });

    it('should recreate grid when price deviates beyond threshold', async () => {
      const newPrice = 120;
      mockCancelAllOrders.mockResolvedValue(undefined);
      await manager.handlePriceDeviation(
        newPrice,
        0.02,
        3,
        100,
        mockPlaceOrder,
        mockCancelAllOrders,
        'INDY/USDT'
      );
      expect(mockCancelAllOrders).toHaveBeenCalledWith('INDY/USDT');
      expect(mockPlaceOrder).toHaveBeenCalled();
    });

    it('should not recreate grid when price deviation is within threshold', async () => {
      const newPrice = 106;
      mockCancelAllOrders.mockClear();
      mockPlaceOrder.mockClear();
      await manager.handlePriceDeviation(
        newPrice,
        0.02,
        3,
        100,
        mockPlaceOrder,
        mockCancelAllOrders,
        'INDY/USDT'
      );
      expect(mockCancelAllOrders).not.toHaveBeenCalled();
      expect(mockPlaceOrder).not.toHaveBeenCalled();
    });
  });

  describe('getActiveOrders', () => {
    it('should return copy of active orders array', async () => {
      const levels: GridLevel[] = [
        { price: 100, side: 'buy', orderSize: 10 }
      ];
      const mockOrder: Order = {
        id: 'test-order',
        symbol: 'INDY/USDT',
        type: 'limit',
        side: 'buy',
        amount: 10,
        price: 100,
        status: 'open',
        timestamp: Date.now(),
        filled: 0,
        remaining: 10
      };
      mockPlaceOrder.mockResolvedValue(mockOrder);
      await manager.placeInitialGrid(levels, mockPlaceOrder);
      const activeOrders = manager.getActiveOrders();
      expect(activeOrders).toHaveLength(1);
      activeOrders.push(mockOrder);
      expect(manager.getActiveOrders()).toHaveLength(1);
    });
  });
});