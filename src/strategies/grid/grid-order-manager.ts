import { Order, OrderSide } from '../../types';
import { GridLevel, GridCalculator } from './grid-calculator';

export interface GridOrderManagerConfig {
  priceDeviationThreshold: number;
  adjustmentDebounce: number;
}

export class GridOrderManager {
  private gridCalculator: GridCalculator;
  private config: GridOrderManagerConfig;
  private activeOrders: Order[] = [];
  private isAdjusting = false;
  private lastAdjustmentTime = 0;
  private currentGridCenter = 0;

  constructor(config: GridOrderManagerConfig) {
    this.config = config;
    this.gridCalculator = new GridCalculator();
  }

  async placeInitialGrid(levels: GridLevel[], placeOrderFn: (side: OrderSide, amount: number, price: number) => Promise<Order>): Promise<Order[]> {
    const orders: Order[] = [];
    
    for (const level of levels) {
      try {
        const order = await placeOrderFn(level.side, level.orderSize, level.price);
        orders.push(order);
      } catch (error) {
        console.error(`Failed to place ${level.side} order at ${level.price}:`, error);
      }
    }
    
    this.activeOrders = orders;
    if (levels.length > 0) {
      const buyLevels = levels.filter(l => l.side === 'buy');
      const sellLevels = levels.filter(l => l.side === 'sell');
      this.currentGridCenter = (Math.max(...buyLevels.map(l => l.price)) + Math.min(...sellLevels.map(l => l.price))) / 2;
    }
    
    return orders;
  }

  async handleOrderFill(
    filledOrder: Order,
    currentPrice: number,
    gridSpacing: number,
    gridLevels: number,
    availableBalance: number,
    placeOrderFn: (side: OrderSide, amount: number, price: number) => Promise<Order>,
    cancelOrderFn: (orderId: string) => Promise<void>
  ): Promise<void> {
    if (this.isAdjusting || Date.now() - this.lastAdjustmentTime < this.config.adjustmentDebounce) {
      return;
    }
    
    this.isAdjusting = true;
    this.lastAdjustmentTime = Date.now();
    
    try {
      await this.cancelAllOrders(cancelOrderFn);
      await this.recreateGridAtPrice(currentPrice, gridSpacing, gridLevels, availableBalance, placeOrderFn);
    } finally {
      this.isAdjusting = false;
    }
  }

  async handlePriceDeviation(
    newPrice: number,
    gridSpacing: number,
    gridLevels: number,
    availableBalance: number,
    placeOrderFn: (side: OrderSide, amount: number, price: number) => Promise<Order>,
    cancelOrderFn: (orderId: string) => Promise<void>
  ): Promise<void> {
    const deviation = Math.abs(newPrice - this.currentGridCenter) / this.currentGridCenter;
    
    if (deviation > this.config.priceDeviationThreshold && !this.isAdjusting) {
      this.isAdjusting = true;
      this.lastAdjustmentTime = Date.now();
      
      try {
        await this.cancelAllOrders(cancelOrderFn);
        await this.recreateGridAtPrice(newPrice, gridSpacing, gridLevels, availableBalance, placeOrderFn);
      } finally {
        this.isAdjusting = false;
      }
    }
  }

  private async cancelAllOrders(cancelOrderFn: (orderId: string) => Promise<void>): Promise<void> {
    // TODO : Optimize cancellation with batch API Cancel orders by exchange
    const cancelPromises = this.activeOrders.map(async (order) => {
      try {
        await cancelOrderFn(order.id);
      } catch (error) {
        console.error(`Failed to cancel order ${order.id}:`, error);
      }
    });
    
    await Promise.all(cancelPromises);
    this.activeOrders = [];
  }

  private async recreateGridAtPrice(
    centerPrice: number,
    gridSpacing: number,
    gridLevels: number,
    availableBalance: number,
    placeOrderFn: (side: OrderSide, amount: number, price: number) => Promise<Order>
  ): Promise<void> {
    const levels = this.gridCalculator.calculateGridLevels(centerPrice, gridSpacing, gridLevels);
    const orderSize = this.gridCalculator.calculateOrderSizes(availableBalance, gridLevels);
    const gridWithSizes = this.gridCalculator.assignOrderSizes(levels, orderSize);
    
    await this.placeInitialGrid(gridWithSizes, placeOrderFn);
    this.currentGridCenter = centerPrice;
  }

  getActiveOrders(): Order[] {
    // TODO Fetch active orders from exchange to ensure sync if not available in memory
    return [...this.activeOrders];
  }
}