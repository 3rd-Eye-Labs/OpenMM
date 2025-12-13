/**
 * Risk Management Types
 */

export interface RiskManagerConfig {
  maxPositionSize: number;          // Max position as percentage of portfolio (0.8 = 80%)
  safetyReservePercentage: number; // Always keep this % in reserve (0.2 = 20%)
  minConfidence: number;           // Minimum price confidence to trade (0.6 = 60%)
}

/**
 * Safety reserve configuration for base and quote currencies
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