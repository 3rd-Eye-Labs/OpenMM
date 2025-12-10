import { BaseStrategy } from '../../core/strategy/base-strategy';
import { Order, OrderSide } from '../../types';
import { StrategyConfig } from '../../types';
import { BaseExchangeConnector } from '../../core/exchange/base-exchange-connector';
import { CardanoPriceService } from '../../core/price-aggregation';
import { RiskManager, RiskManagerConfig } from '../../core/risk-management/risk-manager';
import { GridOrderManager, GridOrderManagerConfig } from './grid-order-manager';
import { GridCalculator } from './grid-calculator';

export interface GridConfig {
  symbol: string;
  gridLevels: number;
  gridSpacing: number;
  orderSize: number;
  minConfidence: number;
  priceDeviationThreshold: number;
  adjustmentDebounce: number;
}

export interface GridStrategyConfig extends StrategyConfig {
  type: 'grid';
  gridConfig: GridConfig;
}

export class GridStrategy extends BaseStrategy {
  private priceService: CardanoPriceService;
  private riskManager: RiskManager;
  private orderManager: GridOrderManager;
  private calculator: GridCalculator;
  private exchangeConnector?: BaseExchangeConnector;
  private gridConfig?: GridConfig;
  private priceUpdateInterval?: NodeJS.Timeout;

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
      
      const aggregatedPrice = await this.priceService.getTokenPrice(this.getSymbol());
      
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
            console.error(`Failed to cancel order ${order.id}:`, error);
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
        (orderId: string) => this.cancelOrder(orderId)
      );
    } catch (error) {
      console.error('Price update handling failed:', error);
    }
  }

  async onOrderUpdate(order: Order): Promise<void> {
    if (order.status === 'filled' && this.gridConfig) {
      try {
        const aggregatedPrice = await this.priceService.getTokenPrice(this.getSymbol());
        const balance = await this.getAvailableBalance();
        
        await this.orderManager.handleOrderFill(
          order,
          aggregatedPrice.price,
          this.gridConfig.gridSpacing,
          this.gridConfig.gridLevels,
          balance,
          (side: OrderSide, amount: number, price: number) => this.placeOrder(side, amount, price),
          (orderId: string) => this.cancelOrder(orderId)
        );
      } catch (error) {
        console.error('Order fill handling failed:', error);
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

  private async cancelOrder(orderId: string): Promise<void> {
    if (!this.exchangeConnector) {
      throw new Error('Exchange connector not set');
    }

    const symbol = this.getSymbol();
    await this.exchangeConnector.cancelOrder(orderId, symbol);
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
        const aggregatedPrice = await this.priceService.getTokenPrice(this.getSymbol());
        await this.onPriceUpdate(this.getSymbol(), aggregatedPrice.price);
      } catch (error) {
        console.error('Price monitoring failed:', error);
      }
    }, 30000); // Check every 30 seconds
  }
}