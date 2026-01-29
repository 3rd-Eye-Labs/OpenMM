import { createLogger } from '../../utils';

export interface VolatilityTrackerConfig {
  /** Number of price samples to keep in the rolling window (default: 10) */
  windowSize: number;
  /** Volatility below this threshold → multiplier stays at 1.0 (default: 0.02 = 2%) */
  lowThreshold: number;
  /** Volatility above this threshold → highest multiplier (default: 0.05 = 5%) */
  highThreshold: number;
  /** Multiplier applied when volatility is between low and high thresholds (default: 1.5) */
  lowMultiplier: number;
  /** Multiplier applied when volatility exceeds high threshold (default: 2.0) */
  highMultiplier: number;
}

const DEFAULT_CONFIG: VolatilityTrackerConfig = {
  windowSize: 10,
  lowThreshold: 0.02,
  highThreshold: 0.05,
  lowMultiplier: 1.5,
  highMultiplier: 2.0,
};

/**
 * Tracks price volatility over a rolling window and maps it to a spread multiplier.
 *
 * Volatility is measured as (max - min) / average over the rolling buffer.
 * The multiplier widens grid spacing during volatile periods and tightens it
 * when the market calms down.
 *
 * Multiplier mapping:
 * - volatility < lowThreshold  → 1.0 (normal)
 * - lowThreshold ≤ volatility < highThreshold → lowMultiplier (elevated)
 * - volatility ≥ highThreshold → highMultiplier (high)
 */
export class VolatilityTracker {
  private prices: number[] = [];
  private lastAppliedMultiplier: number = 1.0;
  private config: VolatilityTrackerConfig;
  private logger = createLogger('volatility-tracker');

  constructor(config?: Partial<VolatilityTrackerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Record a new price sample into the rolling buffer.
   * Oldest samples are dropped when the buffer is full.
   */
  recordPrice(price: number): void {
    this.prices.push(price);
    if (this.prices.length > this.config.windowSize) {
      this.prices.shift();
    }
  }

  /**
   * Calculate current volatility as (max - min) / average over the buffer.
   * Returns 0 if fewer than 2 samples are available.
   */
  getVolatility(): number {
    if (this.prices.length < 2) {
      return 0;
    }

    const min = Math.min(...this.prices);
    const max = Math.max(...this.prices);
    const avg = this.prices.reduce((sum, p) => sum + p, 0) / this.prices.length;

    if (avg === 0) {
      return 0;
    }

    return (max - min) / avg;
  }

  /**
   * Map the current volatility to a spread multiplier.
   * - Below lowThreshold: 1.0 (normal spacing)
   * - Between thresholds: lowMultiplier (elevated spacing)
   * - Above highThreshold: highMultiplier (wide spacing)
   */
  getMultiplier(): number {
    const volatility = this.getVolatility();

    if (volatility >= this.config.highThreshold) {
      return this.config.highMultiplier;
    }

    if (volatility >= this.config.lowThreshold) {
      return this.config.lowMultiplier;
    }

    return 1.0;
  }

  /**
   * Check if the multiplier has changed since it was last applied.
   * If changed, updates the internal tracking so subsequent calls
   * return false until the multiplier changes again.
   */
  hasMultiplierChanged(): boolean {
    const current = this.getMultiplier();
    if (current !== this.lastAppliedMultiplier) {
      this.logger.info(
        `Volatility multiplier changed: ${this.lastAppliedMultiplier} → ${current} ` +
          `(volatility: ${(this.getVolatility() * 100).toFixed(2)}%)`
      );
      this.lastAppliedMultiplier = current;
      return true;
    }
    return false;
  }

  /**
   * Get the number of price samples currently in the buffer.
   */
  getBufferSize(): number {
    return this.prices.length;
  }

  /**
   * Get the current configuration.
   */
  getConfig(): VolatilityTrackerConfig {
    return { ...this.config };
  }

  /**
   * Reset the tracker, clearing all recorded prices.
   */
  reset(): void {
    this.prices = [];
    this.lastAppliedMultiplier = 1.0;
  }
}
