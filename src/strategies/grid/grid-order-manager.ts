import { Order, OrderSide, GridLevel, GridOrderManagerConfig } from '../../types';
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
    gridSpacing: number,
    gridLevels: number,
    availableBalance: number,
    placeOrderFn: (side: OrderSide, amount: number, price: number) => Promise<Order>,
    cancelAllOrdersFn: (symbol: string) => Promise<void>
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

    try {
      await this.cancelAllOrders(cancelAllOrdersFn, filledOrder.symbol);
      await this.recreateGridAtPrice(
        currentPrice,
        gridSpacing,
        gridLevels,
        availableBalance,
        placeOrderFn
      );
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
    cancelAllOrdersFn: (symbol: string) => Promise<void>,
    symbol: string
  ): Promise<void> {
    const deviation = Math.abs(newPrice - this.currentGridCenter) / this.currentGridCenter;

    if (deviation > this.config.priceDeviationThreshold && !this.isAdjusting) {
      this.isAdjusting = true;
      this.lastAdjustmentTime = Date.now();

      try {
        await this.cancelAllOrders(cancelAllOrdersFn, symbol);
        await this.recreateGridAtPrice(
          newPrice,
          gridSpacing,
          gridLevels,
          availableBalance,
          placeOrderFn
        );
      } finally {
        this.isAdjusting = false;
      }
    }
  }

  private async cancelAllOrders(
    cancelAllOrdersFn: (symbol: string) => Promise<void>,
    symbol: string
  ): Promise<void> {
    if (this.activeOrders.length === 0) {
      return;
    }

    try {
      await cancelAllOrdersFn(symbol);
      this.activeOrders = [];
    } catch (error) {
      this.logger.warn(
        `⚠️ Bulk cancellation failed for ${symbol}, falling back to individual cancellation`,
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
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

  /**
   * Check if grid adjustment is currently in progress
   * Used to prevent multiple simultaneous grid recreation events
   */
  isCurrentlyAdjusting(): boolean {
    return this.isAdjusting;
  }
}
