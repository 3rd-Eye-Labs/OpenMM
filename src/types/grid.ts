export interface GridLevel {
  price: number;
  side: 'buy' | 'sell';
  orderSize: number;
}

export interface GridOrderManagerConfig {
  priceDeviationThreshold: number;
  adjustmentDebounce: number;
}

/**
 * Spacing model determines how price levels are distributed
 * - linear: Equal spacing between levels (e.g., 1%, 2%, 3%, 4%)
 * - geometric: Spacing increases per level by a factor (e.g., 0.5%, 1%, 2%, 4%)
 * - custom: User-defined spacing offsets per level
 */
export type SpacingModel = 'linear' | 'geometric' | 'custom';

/**
 * Size model determines how order sizes are distributed across levels
 * - flat: Equal size for all levels
 * - pyramidal: Larger sizes closer to center price, tapering at outer levels
 * - custom: User-defined weight multipliers per level
 */
export type SizeModel = 'flat' | 'pyramidal' | 'custom';

/**
 * Dynamic grid configuration for advanced order level generation
 * Supports up to 10 levels per side (20 total: 10 buy + 10 sell)
 */
export interface DynamicGridConfig {
  /** Number of levels per side (1-10, total orders = levels * 2) */
  levels: number;

  /** How price spacing is calculated between levels */
  spacingModel: SpacingModel;

  /** Base spacing as decimal (e.g., 0.005 = 0.5%) */
  baseSpacing: number;

  /** Geometric only: multiplier applied per level (e.g., 1.3 means each level is 1.3x wider) */
  spacingFactor?: number;

  /** Custom only: explicit spacing offset per level as decimals (array length must equal levels) */
  customSpacings?: number[];

  /** How order sizes are distributed across levels */
  sizeModel: SizeModel;

  /** Base order size in quote currency (e.g., 50 USDT) */
  baseSize: number;

  /** Custom only: per-level size weight multipliers (array length must equal levels) */
  sizeWeights?: number[];

  /**
   * Volatility multiplier that scales all spacings (default: 1.0)
   * Hook for future volatility-based dynamic spread adjustment.
   * Values > 1.0 widen the grid, < 1.0 tighten it.
   */
  volatilityMultiplier?: number;
}

/**
 * Grid profile loaded from a JSON configuration file
 * Allows users to define and share complete grid configurations
 */
export interface GridProfile {
  name?: string;
  description?: string;
  spacingModel: SpacingModel;
  sizeModel: SizeModel;
  levels: number;
  baseSpacing: number;
  spacingFactor?: number;
  customSpacings?: number[];
  baseSize: number;
  sizeWeights?: number[];
}

/**
 * Configuration for volatility-based dynamic spread adjustment.
 * When enabled, the grid automatically widens during volatile periods
 * and tightens when the market calms down.
 */
export interface VolatilityConfig {
  /** Whether volatility-based spread adjustment is enabled */
  enabled: boolean;
  /** Number of price samples in the rolling window (default: 10, ~5 minutes at 30s intervals) */
  windowSize: number;
  /** Volatility below this threshold keeps multiplier at 1.0 (default: 0.02 = 2%) */
  lowThreshold: number;
  /** Volatility above this threshold applies highest multiplier (default: 0.05 = 5%) */
  highThreshold: number;
  /** Multiplier when volatility is between low and high thresholds (default: 1.5) */
  lowMultiplier: number;
  /** Multiplier when volatility exceeds high threshold (default: 2.0) */
  highMultiplier: number;
}
