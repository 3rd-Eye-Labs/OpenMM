import { BaseStrategy } from '../../core/strategy/base-strategy';
import { Order, OrderSide, StrategyConfig, GridConfig, GridStrategyConfig, GridOrderManagerConfig } from '../../types';
import { BaseExchangeConnector } from '../../core/exchange/base-exchange-connector';
import { CardanoPriceService } from '../../core/price-aggregation';
import { RiskManager, RiskManagerConfig } from '../../core/risk-management/risk-manager';
import { GridOrderManager } from './grid-order-manager';
import { GridCalculator } from './grid-calculator';
import { parseSymbol } from '../../utils/symbol-utils';
import { createLogger } from '../../utils';

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
      minConfidence: 0.6
    };
    this.riskManager = new RiskManager(riskConfig);
    
    const orderManagerConfig: GridOrderManagerConfig = {
      priceDeviationThreshold: 0.015,
      adjustmentDebounce: 2000
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
        throw new Error(`Price confidence too low: ${aggregatedPrice.confidence} < ${this.gridConfig.minConfidence}`);
      }

      const balance = await this.getAvailableBalance();
      const gridLevels = this.calculator.calculateGridLevels(
        aggregatedPrice.price,
        this.gridConfig.gridSpacing,
        this.gridConfig.gridLevels
      );
      
      const orderSize = this.calculator.calculateOrderSizes(balance, this.gridConfig.gridLevels);
      const gridWithSizes = this.calculator.assignOrderSizes(gridLevels, orderSize);
      
      await this.orderManager.placeInitialGrid(
        gridWithSizes,
        (side: OrderSide, amount: number, price: number) => this.placeOrder(side, amount, price)
      );

      this.startPriceMonitoring();
      await this.setupOrderSubscription();
      
    } catch (error) {
      this.handleError(error, 'start');
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
            this.logger.error(`Failed to cancel order ${order.id}:`, { error });
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
      
      await this.orderManager.handlePriceDeviation(
        price,
        this.gridConfig.gridSpacing,
        this.gridConfig.gridLevels,
        balance,
        (side: OrderSide, amount: number, price: number) => this.placeOrder(side, amount, price),
        (symbol: string) => this.cancelAllOrders(symbol),
        symbol
      );
    } catch (error) {
      this.logger.error('Price update handling failed:', { error });
    }
  }

  async onOrderUpdate(order: Order): Promise<void> {
    if (order.symbol !== this.getSymbol()) {
      return;
    }
    
    if ((order.status === 'filled' || order.status === 'partially_filled') && this.gridConfig) {
      if (this.orderManager.isCurrentlyAdjusting()) {
        this.logger.info(`⏸️  Grid adjustment in progress, ignoring ${order.status} event`);
        return;
      }
      
      try {
        const { base } = parseSymbol(this.getSymbol());
        const aggregatedPrice = await this.priceService.getTokenPrice(base);
        const balance = await this.getAvailableBalance();
        
        await this.orderManager.handleOrderFill(
          order,
          aggregatedPrice.price,
          this.gridConfig.gridSpacing,
          this.gridConfig.gridLevels,
          balance,
          (side: OrderSide, amount: number, price: number) => this.placeOrder(side, amount, price),
          (symbol: string) => this.cancelAllOrders(symbol)
        );
      } catch (error) {
        this.logger.error('Order fill handling failed:',  { error });
      }
    }
  }

  setExchangeConnector(connector: BaseExchangeConnector): void {
    this.exchangeConnector = connector;
  }

  private async placeOrder(side: OrderSide, amount: number, price: number): Promise<Order> {
    if (!this.exchangeConnector) {
      throw new Error('Exchange connector not set');
    }

    const symbol = this.getSymbol();
    return await this.exchangeConnector.createOrder(symbol, 'limit', side, amount, price);
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
        const { base } = parseSymbol(this.getSymbol());
        const aggregatedPrice = await this.priceService.getTokenPrice(base);
        await this.onPriceUpdate(this.getSymbol(), aggregatedPrice.price);
      } catch (error) {
        this.logger.error('Price monitoring failed:', { error });
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
    } catch (error) {
      this.logger.error('Failed to setup order subscription:', { error });
    }
  }
}