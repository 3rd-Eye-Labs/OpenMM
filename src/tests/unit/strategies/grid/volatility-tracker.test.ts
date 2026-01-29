import { VolatilityTracker } from '../../../../strategies/grid/volatility-tracker';

describe('VolatilityTracker', () => {
  let tracker: VolatilityTracker;

  beforeEach(() => {
    tracker = new VolatilityTracker();
  });

  describe('constructor', () => {
    it('should use default config when none provided', () => {
      const config = tracker.getConfig();
      expect(config.windowSize).toBe(10);
      expect(config.lowThreshold).toBe(0.02);
      expect(config.highThreshold).toBe(0.05);
      expect(config.lowMultiplier).toBe(1.5);
      expect(config.highMultiplier).toBe(2.0);
    });

    it('should accept custom config', () => {
      const custom = new VolatilityTracker({
        windowSize: 5,
        lowThreshold: 0.01,
        highThreshold: 0.03,
        lowMultiplier: 1.2,
        highMultiplier: 1.8,
      });
      const config = custom.getConfig();
      expect(config.windowSize).toBe(5);
      expect(config.lowThreshold).toBe(0.01);
      expect(config.highThreshold).toBe(0.03);
      expect(config.lowMultiplier).toBe(1.2);
      expect(config.highMultiplier).toBe(1.8);
    });

    it('should accept partial config and use defaults for the rest', () => {
      const partial = new VolatilityTracker({ windowSize: 20 });
      const config = partial.getConfig();
      expect(config.windowSize).toBe(20);
      expect(config.lowThreshold).toBe(0.02);
    });
  });

  describe('recordPrice', () => {
    it('should add prices to the buffer', () => {
      tracker.recordPrice(100);
      expect(tracker.getBufferSize()).toBe(1);

      tracker.recordPrice(101);
      expect(tracker.getBufferSize()).toBe(2);
    });

    it('should maintain rolling window by dropping oldest prices', () => {
      const small = new VolatilityTracker({ windowSize: 3 });
      small.recordPrice(100);
      small.recordPrice(101);
      small.recordPrice(102);
      expect(small.getBufferSize()).toBe(3);

      small.recordPrice(103);
      expect(small.getBufferSize()).toBe(3);
    });
  });

  describe('getVolatility', () => {
    it('should return 0 with no prices', () => {
      expect(tracker.getVolatility()).toBe(0);
    });

    it('should return 0 with only one price', () => {
      tracker.recordPrice(100);
      expect(tracker.getVolatility()).toBe(0);
    });

    it('should return 0 when all prices are identical', () => {
      tracker.recordPrice(100);
      tracker.recordPrice(100);
      tracker.recordPrice(100);
      expect(tracker.getVolatility()).toBe(0);
    });

    it('should calculate volatility as (max - min) / average', () => {
      // Prices: 100, 110 → volatility = (110-100) / 105 = 10/105 ≈ 0.0952
      tracker.recordPrice(100);
      tracker.recordPrice(110);
      const volatility = tracker.getVolatility();
      expect(volatility).toBeCloseTo(10 / 105, 6);
    });

    it('should calculate volatility over the full buffer', () => {
      // Prices: 95, 100, 105 → volatility = (105-95) / 100 = 0.10
      tracker.recordPrice(95);
      tracker.recordPrice(100);
      tracker.recordPrice(105);
      expect(tracker.getVolatility()).toBeCloseTo(0.1, 6);
    });

    it('should only consider prices within the window', () => {
      const small = new VolatilityTracker({ windowSize: 3 });
      // Record 4 prices, window keeps last 3
      small.recordPrice(50); // will be dropped
      small.recordPrice(100);
      small.recordPrice(101);
      small.recordPrice(102);

      // Buffer: [100, 101, 102] → volatility = (102-100) / 101 ≈ 0.0198
      expect(small.getVolatility()).toBeCloseTo(2 / 101, 6);
    });
  });

  describe('getMultiplier', () => {
    it('should return 1.0 when volatility is below low threshold', () => {
      // Small price changes → low volatility
      tracker.recordPrice(100);
      tracker.recordPrice(100.5);
      tracker.recordPrice(100.2);
      expect(tracker.getMultiplier()).toBe(1.0);
    });

    it('should return lowMultiplier when volatility is between thresholds', () => {
      // volatility = 3% (between 2% and 5%)
      tracker.recordPrice(100);
      tracker.recordPrice(103);
      const volatility = tracker.getVolatility();
      expect(volatility).toBeGreaterThanOrEqual(0.02);
      expect(volatility).toBeLessThan(0.05);
      expect(tracker.getMultiplier()).toBe(1.5);
    });

    it('should return highMultiplier when volatility exceeds high threshold', () => {
      // volatility = ~6% (above 5%)
      tracker.recordPrice(100);
      tracker.recordPrice(106);
      const volatility = tracker.getVolatility();
      expect(volatility).toBeGreaterThanOrEqual(0.05);
      expect(tracker.getMultiplier()).toBe(2.0);
    });

    it('should return 1.0 with insufficient data', () => {
      tracker.recordPrice(100);
      expect(tracker.getMultiplier()).toBe(1.0);
    });

    it('should use custom multipliers when configured', () => {
      const custom = new VolatilityTracker({
        lowThreshold: 0.01,
        highThreshold: 0.03,
        lowMultiplier: 1.3,
        highMultiplier: 1.8,
      });

      // ~2% volatility → between thresholds → lowMultiplier
      custom.recordPrice(100);
      custom.recordPrice(102);
      expect(custom.getMultiplier()).toBe(1.3);
    });
  });

  describe('hasMultiplierChanged', () => {
    it('should return false when multiplier has not changed', () => {
      tracker.recordPrice(100);
      tracker.recordPrice(100.1);
      // Multiplier is 1.0 (low volatility), same as initial
      expect(tracker.hasMultiplierChanged()).toBe(false);
    });

    it('should return true when multiplier changes from normal to elevated', () => {
      tracker.recordPrice(100);
      tracker.recordPrice(100.1);
      // Start with low volatility
      tracker.hasMultiplierChanged(); // initial: 1.0

      // Add a volatile price
      tracker.recordPrice(103);
      expect(tracker.hasMultiplierChanged()).toBe(true);
    });

    it('should return false on second check after change (no further change)', () => {
      tracker.recordPrice(100);
      tracker.recordPrice(103);
      expect(tracker.hasMultiplierChanged()).toBe(true); // 1.0 → 1.5
      expect(tracker.hasMultiplierChanged()).toBe(false); // still 1.5
    });

    it('should detect change back to normal when volatility drops', () => {
      const small = new VolatilityTracker({ windowSize: 3 });

      // Create elevated volatility
      small.recordPrice(100);
      small.recordPrice(103);
      small.hasMultiplierChanged(); // 1.0 → 1.5

      // Replace with stable prices
      small.recordPrice(103);
      small.recordPrice(103.1);
      // Buffer: [103, 103, 103.1] → very low volatility
      expect(small.hasMultiplierChanged()).toBe(true); // 1.5 → 1.0
      expect(small.getMultiplier()).toBe(1.0);
    });
  });

  describe('reset', () => {
    it('should clear all recorded prices', () => {
      tracker.recordPrice(100);
      tracker.recordPrice(105);
      tracker.reset();
      expect(tracker.getBufferSize()).toBe(0);
      expect(tracker.getVolatility()).toBe(0);
    });

    it('should reset the last applied multiplier', () => {
      tracker.recordPrice(100);
      tracker.recordPrice(106);
      tracker.hasMultiplierChanged(); // updates to 2.0

      tracker.reset();

      // After reset, multiplier should be back to 1.0 baseline
      tracker.recordPrice(100);
      tracker.recordPrice(100.1);
      expect(tracker.hasMultiplierChanged()).toBe(false); // 1.0 → 1.0, no change
    });
  });

  describe('edge cases', () => {
    it('should handle zero price gracefully', () => {
      tracker.recordPrice(0);
      tracker.recordPrice(0);
      expect(tracker.getVolatility()).toBe(0);
      expect(tracker.getMultiplier()).toBe(1.0);
    });

    it('should handle very large price swings', () => {
      tracker.recordPrice(1);
      tracker.recordPrice(1000);
      // volatility = 999 / 500.5 ≈ 1.997 → way above 5%
      expect(tracker.getMultiplier()).toBe(2.0);
    });

    it('should handle very small price values', () => {
      tracker.recordPrice(0.0001);
      tracker.recordPrice(0.0001005);
      // Small but proportional change
      expect(tracker.getMultiplier()).toBe(1.0);
    });

    it('should work correctly at exact threshold boundaries', () => {
      // Exactly at low threshold (2%): prices that give exactly 0.02 volatility
      // avg = 100, range = 2 → volatility = 2/100 = 0.02
      tracker.recordPrice(99);
      tracker.recordPrice(101);
      // volatility = 2/100 = 0.02 → at lowThreshold → elevated
      expect(tracker.getMultiplier()).toBe(1.5);
    });
  });
});
