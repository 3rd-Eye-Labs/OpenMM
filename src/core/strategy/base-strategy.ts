import { Order } from '../../types';
import { StrategyType, StrategyStatus, StrategyConfig } from '../../types';

/**
 * Abstract base class for all trading strategies
 * Provides common functionality and defines the interface that all strategies must implement
 */
export abstract class BaseStrategy {
  protected readonly strategyId: string;
  protected readonly strategyType: StrategyType;
  protected status: StrategyStatus = 'idle';
  protected config?: StrategyConfig;

  constructor(id: string, type: StrategyType) {
    this.strategyId = id;
    this.strategyType = type;
  }

  get id(): string {
    return this.strategyId;
  }

  get type(): StrategyType {
    return this.strategyType;
  }

  get currentStatus(): StrategyStatus {
    return this.status;
  }

  abstract initialize(config: StrategyConfig): Promise<void>;
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;

  abstract onPriceUpdate(symbol: string, price: number): Promise<void>;
  abstract onOrderUpdate(order: Order): Promise<void>;

  // Common utility methods
  protected setStatus(status: StrategyStatus): void {
    this.status = status;
  }

  protected getConfig(): StrategyConfig {
    if (!this.config) {
      throw new Error(`Strategy ${this.strategyId} not initialized`);
    }
    return this.config;
  }

  protected validateConfig(config: StrategyConfig): void {
    if (!config.id || !config.type || !config.symbol || !config.exchange) {
      throw new Error('Invalid strategy configuration');
    }
  }

  // Error handling helper
  protected handleError(error: any, operation: string): void {
    const message = error?.message || error?.toString() || 'Unknown error';
    this.setStatus('error');
    throw new Error(`Strategy ${this.strategyId} ${operation} failed: ${message}`);
  }
}
