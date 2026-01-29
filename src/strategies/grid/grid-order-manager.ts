import {
  Order,
  OrderSide,
  GridLevel,
  GridOrderManagerConfig,
  DynamicGridConfig,
} from '../../types';
import { GridCalculator } from './grid-calculator';
import { createLogger } from '../../utils';

export class GridOrderManager {
  private gridCalculator: GridCalculator;
  private logger = createLogger('grid-manager');
  private config: GridOrderManagerConfig;
  private activeOrders: Order[] = [];
  private isAdjusting = false;
  private lastAdjustmentTime = 0;
  private currentGridCenter = 0;

  constructor(config: GridOrderManagerConfig) {
    this.config = config;
    this.gridCalculator = new GridCalculator();
  }

  setCurrentGridCenter(price: number): void {
    this.currentGridCenter = price;
  }

  async placeInitialGrid(
    levels: GridLevel[],
    placeOrderFn: (side: OrderSide, amount: number, price: number) => Promise<Order>
  ): Promise<Order[]> {
    const orders: Order[] = [];

    for (const level of levels) {
      try {
        const order = await placeOrderFn(level.side, level.orderSize, level.price);
        orders.push(order);
        this.logger.info(
          `Placed ${level.side.toUpperCase()} order: ${level.orderSize.toFixed(3)} @ $${level.price.toFixed(6)}`,
          { orderId: order.id }
        );
      } catch (error) {
        this.logger.error(`Failed to place ${level.side} order at ${level.price}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.activeOrders = orders;
    if (levels.length > 0) {
      const buyLevels = levels.filter(l => l.side === 'buy');
      const sellLevels = levels.filter(l => l.side === 'sell');
      this.currentGridCenter =
        (Math.max(...buyLevels.map(l => l.price)) + Math.min(...sellLevels.map(l => l.price))) / 2;
    }

    return orders;
  }

  async handleOrderFill(
    filledOrder: Order,
    currentPrice: number,
    availableBalance: number,
    placeOrderFn: (side: OrderSide, amount: number, price: number) => Promise<Order>,
    cancelAllOrdersFn: (symbol: string) => Promise<void>,
    dynamicGridConfig: DynamicGridConfig,
    minOrderValue?: number,
    cancelOrderFn?: (orderId: string, symbol: string) => Promise<void>
  ): Promise<void> {
    this.logger.info(
      `Order FILLED: ${filledOrder.side.toUpperCase()} ${filledOrder.filled} @ $${filledOrder.price}`,
      { orderId: filledOrder.id }
    );

    if (this.isAdjusting || Date.now() - this.lastAdjustmentTime < this.config.adjustmentDebounce) {
      return;
    }

    this.isAdjusting = true;
    this.lastAdjustmentTime = Date.now();

    this.activeOrders = this.activeOrders.filter(o => o.id !== filledOrder.id);

    try {
      const cancelled = await this.cancelAllOrders(
        cancelAllOrdersFn,
        filledOrder.symbol,
        cancelOrderFn
      );

      if (!cancelled) {
        this.logger.error(
          '❌ Order cancellation failed - aborting grid recreation to prevent duplicate orders'
        );
        return;
      }

      await this.recreateGrid(
        currentPrice,
        dynamicGridConfig,
        availableBalance,
        placeOrderFn,
        minOrderValue
      );
    } finally {
      this.isAdjusting = false;
    }
  }

  async handlePriceDeviation(
    newPrice: number,
    availableBalance: number,
    placeOrderFn: (side: OrderSide, amount: number, price: number) => Promise<Order>,
    cancelAllOrdersFn: (symbol: string) => Promise<void>,
    symbol: string,
    dynamicGridConfig: DynamicGridConfig,
    minOrderValue?: number,
    cancelOrderFn?: (orderId: string, symbol: string) => Promise<void>
  ): Promise<void> {
    const deviation = Math.abs(newPrice - this.currentGridCenter) / this.currentGridCenter;

    if (deviation > this.config.priceDeviationThreshold && !this.isAdjusting) {
      this.isAdjusting = true;
      this.lastAdjustmentTime = Date.now();

      try {
        const cancelled = await this.cancelAllOrders(cancelAllOrdersFn, symbol, cancelOrderFn);

        if (!cancelled) {
          this.logger.error(
            '❌ Order cancellation failed - aborting grid recreation to prevent duplicate orders'
          );
          return;
        }

        await this.recreateGrid(
          newPrice,
          dynamicGridConfig,
          availableBalance,
          placeOrderFn,
          minOrderValue
        );
      } finally {
        this.isAdjusting = false;
      }
    }
  }

  private async cancelAllOrders(
    cancelAllOrdersFn: (symbol: string) => Promise<void>,
    symbol: string,
    cancelOrderFn?: (orderId: string, symbol: string) => Promise<void>
  ): Promise<boolean> {
    if (this.activeOrders.length === 0) {
      return true;
    }

    try {
      await cancelAllOrdersFn(symbol);
      this.activeOrders = [];
      this.logger.info(`✅ Successfully cancelled all orders for ${symbol}`);
      return true;
    } catch (error) {
      this.logger.warn(
        `⚠️ Bulk cancellation failed for ${symbol}, falling back to individual cancellation`,
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );

      if (!cancelOrderFn) {
        this.logger.error(
          '❌ Individual order cancellation not available - cannot recover from bulk cancellation failure'
        );
        return false;
      }

      const failedCancellations: string[] = [];
      const ordersToCancel = [...this.activeOrders];

      for (const order of ordersToCancel) {
        try {
          await cancelOrderFn(order.id, order.symbol);
          this.activeOrders = this.activeOrders.filter(o => o.id !== order.id);
        } catch (cancelError) {
          this.logger.error(`Failed to cancel order ${order.id}:`, {
            error: cancelError instanceof Error ? cancelError.message : String(cancelError),
          });
          failedCancellations.push(order.id);
        }
      }

      if (failedCancellations.length > 0) {
        this.logger.error(
          `❌ Failed to cancel ${failedCancellations.length} orders. Aborting grid recreation.`
        );
        return false;
      }

      this.activeOrders = [];
      return true;
    }
  }

  /**
   * Recreate the grid using the dynamic grid calculator.
   * This replaces the old recreateGridAtPrice method with full dynamic support.
   */
  private async recreateGrid(
    centerPrice: number,
    dynamicGridConfig: DynamicGridConfig,
    availableBalance: number,
    placeOrderFn: (side: OrderSide, amount: number, price: number) => Promise<Order>,
    minOrderValue?: number
  ): Promise<void> {
    const gridWithSizes = this.gridCalculator.generateDynamicGrid(
      centerPrice,
      dynamicGridConfig,
      availableBalance,
      minOrderValue
    );

    await this.placeInitialGrid(gridWithSizes, placeOrderFn);
    this.currentGridCenter = centerPrice;
  }

  getActiveOrders(): Order[] {
    // TODO Fetch active orders from exchange to ensure sync if not available in memory
    return [...this.activeOrders];
  }

  /**
   * Check if grid adjustment is currently in progress
   * Used to prevent multiple simultaneous grid recreation events
   */
  isCurrentlyAdjusting(): boolean {
    return this.isAdjusting;
  }
}
