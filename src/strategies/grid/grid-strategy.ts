import { BaseStrategy } from '../../core/strategy/base-strategy';
import {
  Order,
  OrderSide,
  StrategyConfig,
  GridConfig,
  GridStrategyConfig,
  GridOrderManagerConfig,
  RiskManagerConfig,
  DynamicGridConfig,
} from '../../types';
import { BaseExchangeConnector } from '../../core/exchange/base-exchange-connector';
import { CardanoPriceService } from '../../core/price-aggregation';
import { RiskManager } from '../../core/risk-management/risk-manager';
import { GridOrderManager } from './grid-order-manager';
import { GridCalculator } from './grid-calculator';
import { parseSymbol } from '../../utils/symbol-utils';
import { createLogger, ExchangeUtils } from '../../utils';

export class GridStrategy extends BaseStrategy {
  private priceService: CardanoPriceService;
  private riskManager: RiskManager;
  private orderManager: GridOrderManager;
  private calculator: GridCalculator;
  private exchangeConnector?: BaseExchangeConnector;
  private gridConfig?: GridConfig;
  private priceUpdateInterval?: NodeJS.Timeout;
  private logger = createLogger('grid-strategy');

  constructor(id: string) {
    super(id, 'grid');

    this.priceService = new CardanoPriceService();
    this.calculator = new GridCalculator();

    const riskConfig: RiskManagerConfig = {
      maxPositionSize: 0.8,
      safetyReservePercentage: 0.2,
      minConfidence: 0.6,
    };
    this.riskManager = new RiskManager(riskConfig);

    const orderManagerConfig: GridOrderManagerConfig = {
      priceDeviationThreshold: 0.015,
      adjustmentDebounce: 2000,
    };
    this.orderManager = new GridOrderManager(orderManagerConfig);
  }

  protected validateConfig(config: StrategyConfig): void {
    super.validateConfig(config);

    const gridStrategyConfig = config as GridStrategyConfig;
    if (!gridStrategyConfig.gridConfig) {
      throw new Error('Grid strategy requires gridConfig');
    }
  }

  async initialize(config: StrategyConfig): Promise<void> {
    this.validateConfig(config);

    const gridStrategyConfig = config as GridStrategyConfig;
    this.config = config;
    this.gridConfig = gridStrategyConfig.gridConfig;

    this.setStatus('idle');
  }

  async start(): Promise<void> {
    if (!this.gridConfig || !this.exchangeConnector) {
      throw new Error('Strategy not properly initialized');
    }

    try {
      this.setStatus('running');
      const { base } = parseSymbol(this.getSymbol());
      const aggregatedPrice = await this.priceService.getTokenPrice(base);

      if (!this.riskManager.checkPriceConfidence(aggregatedPrice)) {
        throw new Error(
          `Price confidence too low: ${aggregatedPrice.confidence} < ${this.gridConfig.minConfidence}`
        );
      }

      const balance = await this.getAvailableBalance();

      const ticker = await this.exchangeConnector.getTicker(this.getSymbol());
      const exchangeMidPrice = (ticker.bid + ticker.ask) / 2;

      const dynamicConfig = this.getDynamicGridConfig();
      const minOrderValue = this.config
        ? ExchangeUtils.getMinimumOrderValue(this.config.exchange, this.config.symbol)
        : 0;

      const gridWithSizes = this.calculator.generateDynamicGrid(
        exchangeMidPrice,
        dynamicConfig,
        balance,
        minOrderValue
      );

      this.logGridConfiguration(dynamicConfig, gridWithSizes.length);

      await this.setupOrderSubscription();

      await new Promise(resolve => setTimeout(resolve, 500));

      await this.orderManager.placeInitialGrid(
        gridWithSizes,
        (side: OrderSide, amount: number, price: number) => this.placeOrder(side, amount, price)
      );

      this.orderManager.setCurrentGridCenter(exchangeMidPrice);

      const openOrders = await this.exchangeConnector?.getOpenOrders(this.getSymbol());
      const expectedOrderCount = dynamicConfig.levels * 2; // buy + sell orders
      const actualOrderCount = openOrders?.length || 0;

      if (actualOrderCount < expectedOrderCount) {
        this.logger.info(
          `${expectedOrderCount - actualOrderCount} orders filled immediately, recreating grid...`
        );

        setTimeout(async () => {
          try {
            const ticker = await this.exchangeConnector?.getTicker(this.getSymbol());
            if (ticker) {
              const exchangeMidPrice = (ticker.bid + ticker.ask) / 2;
              await this.onPriceUpdate(this.getSymbol(), exchangeMidPrice);
            }
          } catch (error) {
            this.logger.error('Failed to recreate grid after immediate fills:', {
              error: String(error),
            });
          }
        }, 2000);
      }

      this.startPriceMonitoring();
    } catch (error) {
      this.logger.error('❌ Grid strategy start failed:', { error: String(error) });
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.setStatus('stopped');

      if (this.priceUpdateInterval) {
        clearInterval(this.priceUpdateInterval);
        this.priceUpdateInterval = undefined;
      }

      if (this.exchangeConnector) {
        const openOrders = this.orderManager.getActiveOrders();
        for (const order of openOrders) {
          try {
            await this.exchangeConnector.cancelOrder(order.id, order.symbol);
          } catch (error) {
            this.logger.error(`Failed to cancel order ${order.id}:`, { error: String(error) });
          }
        }
      }
    } catch (error) {
      this.handleError(error, 'stop');
    }
  }

  async onPriceUpdate(symbol: string, price: number): Promise<void> {
    if (!this.gridConfig || symbol !== this.getSymbol()) {
      return;
    }

    try {
      const balance = await this.getAvailableBalance();
      const dynamicConfig = this.getDynamicGridConfig();
      const minOrderValue = this.config
        ? ExchangeUtils.getMinimumOrderValue(this.config.exchange, this.config.symbol)
        : 0;

      await this.orderManager.handlePriceDeviation(
        price,
        balance,
        (side: OrderSide, amount: number, price: number) => this.placeOrder(side, amount, price),
        (symbol: string) => this.cancelAllOrders(symbol),
        symbol,
        dynamicConfig,
        minOrderValue,
        (orderId: string, symbol: string) => this.cancelOrder(orderId, symbol)
      );
    } catch (error) {
      this.logger.error('Price update handling failed:', { error: String(error) });
    }
  }

  async onOrderUpdate(order: Order): Promise<void> {
    if (order.symbol !== this.getSymbol()) {
      return;
    }

    if ((order.status === 'filled' || order.status === 'partially_filled') && this.gridConfig) {
      if (this.orderManager.isCurrentlyAdjusting()) {
        this.logger.info(`⏸️ Grid adjustment in progress, ignoring ${order.status} event`);
        return;
      }

      try {
        const ticker = await this.exchangeConnector?.getTicker(this.getSymbol());
        if (!ticker) return;

        const exchangeMidPrice = (ticker.bid + ticker.ask) / 2;
        const balance = await this.getAvailableBalance();
        const dynamicConfig = this.getDynamicGridConfig();
        const minOrderValue = this.config
          ? ExchangeUtils.getMinimumOrderValue(this.config.exchange, this.config.symbol)
          : 0;

        await this.orderManager.handleOrderFill(
          order,
          exchangeMidPrice,
          balance,
          (side: OrderSide, amount: number, price: number) => this.placeOrder(side, amount, price),
          (symbol: string) => this.cancelAllOrders(symbol),
          dynamicConfig,
          minOrderValue,
          (orderId: string, symbol: string) => this.cancelOrder(orderId, symbol)
        );
      } catch (error) {
        this.logger.error('Order fill handling failed:', { error: String(error) });
      }
    }
  }

  setExchangeConnector(connector: BaseExchangeConnector): void {
    this.exchangeConnector = connector;
  }

  setRiskConfig(riskConfig: RiskManagerConfig): void {
    this.riskManager = new RiskManager(riskConfig);
  }

  /**
   * Get the DynamicGridConfig from the current gridConfig.
   * dynamicGrid is always set by the StrategyFactory.
   */
  private getDynamicGridConfig(): DynamicGridConfig {
    if (!this.gridConfig?.dynamicGrid) {
      throw new Error('DynamicGridConfig is required but not set in gridConfig');
    }
    return this.gridConfig.dynamicGrid;
  }

  /**
   * Log the active grid configuration for visibility
   */
  private logGridConfiguration(config: DynamicGridConfig, totalOrders: number): void {
    this.logger.info(`📊 Grid Configuration:`);
    this.logger.info(`  Levels: ${config.levels} per side (${totalOrders} total orders)`);
    this.logger.info(`  Spacing Model: ${config.spacingModel}`);
    this.logger.info(`  Base Spacing: ${(config.baseSpacing * 100).toFixed(2)}%`);
    if (config.spacingModel === 'geometric') {
      this.logger.info(`  Spacing Factor: ${config.spacingFactor}`);
    }
    this.logger.info(`  Size Model: ${config.sizeModel}`);
    this.logger.info(`  Base Size: $${config.baseSize}`);
    if (config.volatilityMultiplier && config.volatilityMultiplier !== 1.0) {
      this.logger.info(`  Volatility Multiplier: ${config.volatilityMultiplier}`);
    }
  }

  private async placeOrder(side: OrderSide, amount: number, price: number): Promise<Order> {
    if (!this.exchangeConnector) {
      throw new Error('Exchange connector not set');
    }

    const symbol = this.getSymbol();
    return await this.exchangeConnector.createOrder(symbol, 'limit', side, amount, price);
  }

  private async cancelOrder(orderId: string, symbol: string): Promise<void> {
    if (!this.exchangeConnector) {
      throw new Error('Exchange connector not set');
    }

    await this.exchangeConnector.cancelOrder(orderId, symbol);
  }

  private async cancelAllOrders(symbol: string): Promise<void> {
    if (!this.exchangeConnector) {
      throw new Error('Exchange connector not set');
    }

    await this.exchangeConnector.cancelAllOrders(symbol);
  }

  private async getAvailableBalance(): Promise<number> {
    if (!this.exchangeConnector) {
      throw new Error('Exchange connector not set');
    }

    const balances = await this.exchangeConnector.getBalance();
    const symbol = this.getSymbol();
    const quoteAsset = symbol.split('/')[1];
    const balance = balances[quoteAsset];

    if (!balance) {
      throw new Error(`No balance found for ${quoteAsset}`);
    }

    return this.riskManager.calculateAvailableBalance(balance);
  }

  private getSymbol(): string {
    const config = this.getConfig();
    return config.symbol;
  }

  private startPriceMonitoring(): void {
    this.priceUpdateInterval = setInterval(async () => {
      try {
        const ticker = await this.exchangeConnector?.getTicker(this.getSymbol());
        if (ticker) {
          const exchangeMidPrice = (ticker.bid + ticker.ask) / 2;
          await this.onPriceUpdate(this.getSymbol(), exchangeMidPrice);
        }
      } catch (error) {
        this.logger.error('Price monitoring failed:', { error: String(error) });
      }
    }, 30000);
  }

  private async setupOrderSubscription(): Promise<void> {
    if (!this.exchangeConnector) {
      throw new Error('Exchange connector not set');
    }

    try {
      await this.exchangeConnector.connectUserDataStream();

      await this.exchangeConnector.subscribeUserOrders((order: Order) => {
        this.onOrderUpdate(order);
      });

      if (!this.exchangeConnector.isUserDataStreamConnected()) {
        throw new Error('Failed to establish user data stream connection');
      }
    } catch (error) {
      this.logger.error('Failed to setup order subscription:', { error: String(error) });
    }
  }
}
