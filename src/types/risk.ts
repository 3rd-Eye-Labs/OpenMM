/**
 * Risk Management Types
 * Universal risk framework that works across all strategies and exchanges
 */

export interface RiskLimits {
  maxPositionSize: number;        // Max position as percentage of portfolio (0.8 = 80%)
  maxDrawdown: number;            // Max portfolio drawdown allowed (0.05 = 5%)
  maxDailyLoss: number;          // Max daily loss in quote currency
  maxOpenOrders: number;         // Maximum number of open orders (20)
  safetyReservePercentage: number; // Always keep this % in reserve (0.2 = 20%)
}

export interface PositionLimits {
  maxBasePosition: number;       // Max base currency position
  maxQuotePosition: number;      // Max quote currency position
  maxOrderValue: number;         // Max single order value
}

export interface RiskMetrics {
  currentDrawdown: number;
  dailyPnL: number;
  totalPnL: number;
  positionSize: number;
  openOrderCount: number;
  reserveRatio: number;
  lastRiskCheck: Date;
}

export interface RiskViolation {
  type: 'position_limit' | 'drawdown' | 'daily_loss' | 'order_count' | 'reserve_breach';
  severity: 'warning' | 'critical';
  message: string;
  currentValue: number;
  limit: number;
  timestamp: Date;
}

export interface RiskCheckResult {
  passed: boolean;
  violations: RiskViolation[];
  metrics: RiskMetrics;
  recommendedAction?: string;
}

/**
 * Safety reserve configuration
 */
export interface SafetyReserves {
  base: {
    minimum: number;           // Minimum base currency to keep
    percentage: number;        // % of base balance to reserve
  };
  quote: {
    minimum: number;          // Minimum quote currency to keep  
    percentage: number;       // % of quote balance to reserve
  };
}