import { Order, OrderSide } from '../../types';
import { Balance } from '../../types';
import { AggregatedPrice } from '../../types';
import { RiskLimits } from '../../types';

export interface RiskManagerConfig {
  maxPositionSize: number;
  safetyReservePercentage: number;
  minConfidence: number;
}

export class RiskManager {
  private config: RiskManagerConfig;

  constructor(config: RiskManagerConfig) {
    this.config = config;
  }

  validatePosition(newOrder: Order, balance: Balance): boolean {
    const currentExposure = this.getCurrentExposure(balance);
    const orderValue = newOrder.amount * (newOrder.price || 0);
    const totalExposure = currentExposure + orderValue;
    
    return totalExposure <= balance.total * this.config.maxPositionSize;
  }

  checkPriceConfidence(aggregatedPrice: AggregatedPrice): boolean {
    return aggregatedPrice.confidence >= this.config.minConfidence;
  }

  calculateAvailableBalance(balance: Balance): number {
    return balance.total * (1 - this.config.safetyReservePercentage);
  }

  private getCurrentExposure(balance: Balance): number {
    return balance.used;
  }

  validateTrade(order: Order, balance: Balance, aggregatedPrice: AggregatedPrice): {
    valid: boolean;
    reason?: string;
  } {
    if (!this.checkPriceConfidence(aggregatedPrice)) {
      return {
        valid: false,
        reason: `Price confidence too low: ${aggregatedPrice.confidence} < ${this.config.minConfidence}`
      };
    }

    if (!this.validatePosition(order, balance)) {
      return {
        valid: false,
        reason: `Position size would exceed ${this.config.maxPositionSize * 100}% limit`
      };
    }

    return { valid: true };
  }
}