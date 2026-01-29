import { GridCalculator } from '../../../../strategies/grid/grid-calculator';
import { DynamicGridConfig } from '../../../../types';

describe('GridCalculator', () => {
  let calculator: GridCalculator;
  beforeEach(() => {
    calculator = new GridCalculator();
  });

  describe('generateDynamicGrid - linear spacing, flat sizing', () => {
    it('should generate correct grid levels around center price', () => {
      const config: DynamicGridConfig = {
        levels: 3,
        spacingModel: 'linear',
        baseSpacing: 0.02,
        sizeModel: 'flat',
        baseSize: 50,
      };
      const centerPrice = 0.42;
      const availableBalance = 10000;

      const gridLevels = calculator.generateDynamicGrid(centerPrice, config, availableBalance);

      expect(gridLevels).toHaveLength(6);
      const buyOrders = gridLevels.filter(level => level.side === 'buy');
      const sellOrders = gridLevels.filter(level => level.side === 'sell');
      expect(buyOrders).toHaveLength(3);
      expect(sellOrders).toHaveLength(3);

      // Linear: level 1 = 2%, level 2 = 4%, level 3 = 6%
      expect(buyOrders[0].price).toBeCloseTo(centerPrice * 0.98);
      expect(buyOrders[1].price).toBeCloseTo(centerPrice * 0.96);
      expect(buyOrders[2].price).toBeCloseTo(centerPrice * 0.94);
      expect(sellOrders[0].price).toBeCloseTo(centerPrice * 1.02);
      expect(sellOrders[1].price).toBeCloseTo(centerPrice * 1.04);
      expect(sellOrders[2].price).toBeCloseTo(centerPrice * 1.06);
    });

    it('should handle single level grid', () => {
      const config: DynamicGridConfig = {
        levels: 1,
        spacingModel: 'linear',
        baseSpacing: 0.01,
        sizeModel: 'flat',
        baseSize: 50,
      };
      const centerPrice = 1.0;
      const availableBalance = 10000;

      const gridLevels = calculator.generateDynamicGrid(centerPrice, config, availableBalance);

      expect(gridLevels).toHaveLength(2);
      expect(gridLevels.find(l => l.side === 'buy')?.price).toBeCloseTo(0.99);
      expect(gridLevels.find(l => l.side === 'sell')?.price).toBeCloseTo(1.01);
    });

    it('should assign equal order sizes for flat model', () => {
      const config: DynamicGridConfig = {
        levels: 2,
        spacingModel: 'linear',
        baseSpacing: 0.02,
        sizeModel: 'flat',
        baseSize: 50,
      };
      const centerPrice = 1.0;
      const availableBalance = 10000;

      const gridLevels = calculator.generateDynamicGrid(centerPrice, config, availableBalance);

      // All levels should have equal quote-equivalent sizes
      const buyOrders = gridLevels.filter(l => l.side === 'buy');
      const sellOrders = gridLevels.filter(l => l.side === 'sell');

      // orderSize = baseSize / price, so sizes in base differ but quote equivalent is same
      expect(buyOrders[0].orderSize * buyOrders[0].price).toBeCloseTo(50);
      expect(buyOrders[1].orderSize * buyOrders[1].price).toBeCloseTo(50);
      expect(sellOrders[0].orderSize * sellOrders[0].price).toBeCloseTo(50);
      expect(sellOrders[1].orderSize * sellOrders[1].price).toBeCloseTo(50);
    });

    it('should cap total allocation at 80% of available balance', () => {
      const config: DynamicGridConfig = {
        levels: 5,
        spacingModel: 'linear',
        baseSpacing: 0.02,
        sizeModel: 'flat',
        baseSize: 100, // 100 * 5 levels * 2 sides = 1000, but balance is only 500
      };
      const centerPrice = 1.0;
      const availableBalance = 500;

      const gridLevels = calculator.generateDynamicGrid(centerPrice, config, availableBalance);

      // Total allocation should not exceed 80% of 500 = 400
      const totalQuoteAllocated = gridLevels.reduce(
        (sum, level) => sum + level.orderSize * level.price,
        0
      );
      expect(totalQuoteAllocated).toBeLessThanOrEqual(400 + 1); // small floating point tolerance
    });
  });

  describe('generateDynamicGrid - geometric spacing', () => {
    it('should generate increasing spacing between levels', () => {
      const config: DynamicGridConfig = {
        levels: 4,
        spacingModel: 'geometric',
        baseSpacing: 0.005,
        spacingFactor: 1.5,
        sizeModel: 'flat',
        baseSize: 50,
      };
      const centerPrice = 100;
      const availableBalance = 10000;

      const gridLevels = calculator.generateDynamicGrid(centerPrice, config, availableBalance);

      expect(gridLevels).toHaveLength(8);

      const buyOrders = gridLevels.filter(l => l.side === 'buy');

      // Gaps should increase: 0.5%, 0.75%, 1.125%, 1.6875%
      // Cumulative: 0.5%, 1.25%, 2.375%, 4.0625%
      const gap1 = centerPrice - buyOrders[0].price;
      const gap2 = buyOrders[0].price - buyOrders[1].price;
      const gap3 = buyOrders[1].price - buyOrders[2].price;
      const gap4 = buyOrders[2].price - buyOrders[3].price;

      // Each gap should be larger than the previous
      expect(gap2).toBeGreaterThan(gap1 * 1.3); // factor is 1.5, so gap2 > gap1
      expect(gap3).toBeGreaterThan(gap2 * 1.3);
      expect(gap4).toBeGreaterThan(gap3 * 1.3);
    });

    it('should use default spacing factor of 1.3 when not specified', () => {
      const config: DynamicGridConfig = {
        levels: 2,
        spacingModel: 'geometric',
        baseSpacing: 0.01,
        sizeModel: 'flat',
        baseSize: 50,
      };
      const centerPrice = 100;
      const availableBalance = 10000;

      const gridLevels = calculator.generateDynamicGrid(centerPrice, config, availableBalance);
      const buyOrders = gridLevels.filter(l => l.side === 'buy');

      // Level 1 cumulative = 0.01, Level 2 cumulative = 0.01 + 0.013 = 0.023
      expect(buyOrders[0].price).toBeCloseTo(100 * (1 - 0.01));
      expect(buyOrders[1].price).toBeCloseTo(100 * (1 - 0.023));
    });
  });

  describe('generateDynamicGrid - custom spacing', () => {
    it('should use user-provided spacing offsets', () => {
      const config: DynamicGridConfig = {
        levels: 3,
        spacingModel: 'custom',
        baseSpacing: 0.01, // not used for custom, but required field
        customSpacings: [0.005, 0.015, 0.04],
        sizeModel: 'flat',
        baseSize: 50,
      };
      const centerPrice = 100;
      const availableBalance = 10000;

      const gridLevels = calculator.generateDynamicGrid(centerPrice, config, availableBalance);
      const buyOrders = gridLevels.filter(l => l.side === 'buy');

      expect(buyOrders[0].price).toBeCloseTo(100 * 0.995);
      expect(buyOrders[1].price).toBeCloseTo(100 * 0.985);
      expect(buyOrders[2].price).toBeCloseTo(100 * 0.96);
    });

    it('should throw if custom spacings length does not match levels', () => {
      const config: DynamicGridConfig = {
        levels: 3,
        spacingModel: 'custom',
        baseSpacing: 0.01,
        customSpacings: [0.005, 0.015], // only 2, need 3
        sizeModel: 'flat',
        baseSize: 50,
      };

      expect(() => calculator.generateDynamicGrid(100, config, 10000)).toThrow(
        'Custom spacing model requires exactly 3 spacing values'
      );
    });

    it('should throw if custom spacings are not in increasing order', () => {
      const config: DynamicGridConfig = {
        levels: 3,
        spacingModel: 'custom',
        baseSpacing: 0.01,
        customSpacings: [0.02, 0.01, 0.03], // not increasing
        sizeModel: 'flat',
        baseSize: 50,
      };

      expect(() => calculator.generateDynamicGrid(100, config, 10000)).toThrow(
        'Custom spacings must be in increasing order'
      );
    });
  });

  describe('generateDynamicGrid - pyramidal sizing', () => {
    it('should assign larger sizes to levels closer to center', () => {
      const config: DynamicGridConfig = {
        levels: 4,
        spacingModel: 'linear',
        baseSpacing: 0.02,
        sizeModel: 'pyramidal',
        baseSize: 50,
      };
      const centerPrice = 100;
      const availableBalance = 10000;

      const gridLevels = calculator.generateDynamicGrid(centerPrice, config, availableBalance);
      const buyOrders = gridLevels.filter(l => l.side === 'buy');

      // Level 1 (closest to center) should have largest size
      const size1 = buyOrders[0].orderSize * buyOrders[0].price;
      const size2 = buyOrders[1].orderSize * buyOrders[1].price;
      const size3 = buyOrders[2].orderSize * buyOrders[2].price;
      const size4 = buyOrders[3].orderSize * buyOrders[3].price;

      expect(size1).toBeGreaterThan(size2);
      expect(size2).toBeGreaterThan(size3);
      expect(size3).toBeGreaterThan(size4);
    });
  });

  describe('generateDynamicGrid - custom sizing', () => {
    it('should apply user-provided weight multipliers', () => {
      const config: DynamicGridConfig = {
        levels: 3,
        spacingModel: 'linear',
        baseSpacing: 0.02,
        sizeModel: 'custom',
        baseSize: 100,
        sizeWeights: [2.0, 1.0, 0.5],
      };
      const centerPrice = 100;
      const availableBalance = 10000;

      const gridLevels = calculator.generateDynamicGrid(centerPrice, config, availableBalance);
      const buyOrders = gridLevels.filter(l => l.side === 'buy');

      // Weight ratios should be 2:1:0.5
      const quoteSize1 = buyOrders[0].orderSize * buyOrders[0].price;
      const quoteSize2 = buyOrders[1].orderSize * buyOrders[1].price;
      const quoteSize3 = buyOrders[2].orderSize * buyOrders[2].price;

      expect(quoteSize1 / quoteSize2).toBeCloseTo(2.0);
      expect(quoteSize2 / quoteSize3).toBeCloseTo(2.0);
    });

    it('should throw if custom weights length does not match levels', () => {
      const config: DynamicGridConfig = {
        levels: 3,
        spacingModel: 'linear',
        baseSpacing: 0.02,
        sizeModel: 'custom',
        baseSize: 50,
        sizeWeights: [1.0, 0.5], // only 2, need 3
      };

      expect(() => calculator.generateDynamicGrid(100, config, 10000)).toThrow(
        'Custom size model requires exactly 3 weight values'
      );
    });
  });

  describe('generateDynamicGrid - volatility multiplier', () => {
    it('should widen grid when volatility multiplier is greater than 1', () => {
      const baseConfig: DynamicGridConfig = {
        levels: 3,
        spacingModel: 'linear',
        baseSpacing: 0.02,
        sizeModel: 'flat',
        baseSize: 50,
      };

      const volatileConfig: DynamicGridConfig = {
        ...baseConfig,
        volatilityMultiplier: 2.0,
      };

      const centerPrice = 100;
      const availableBalance = 10000;

      const baseLevels = calculator.generateDynamicGrid(centerPrice, baseConfig, availableBalance);
      const wideLevels = calculator.generateDynamicGrid(
        centerPrice,
        volatileConfig,
        availableBalance
      );

      const baseBuys = baseLevels.filter(l => l.side === 'buy');
      const wideBuys = wideLevels.filter(l => l.side === 'buy');

      // With 2x multiplier, spacing should be doubled
      const baseSpread = centerPrice - baseBuys[0].price;
      const wideSpread = centerPrice - wideBuys[0].price;
      expect(wideSpread).toBeCloseTo(baseSpread * 2.0);
    });

    it('should not affect grid when volatility multiplier is 1.0', () => {
      const config: DynamicGridConfig = {
        levels: 2,
        spacingModel: 'linear',
        baseSpacing: 0.02,
        sizeModel: 'flat',
        baseSize: 50,
        volatilityMultiplier: 1.0,
      };

      const configWithout: DynamicGridConfig = {
        levels: 2,
        spacingModel: 'linear',
        baseSpacing: 0.02,
        sizeModel: 'flat',
        baseSize: 50,
      };

      const centerPrice = 100;
      const availableBalance = 10000;

      const levelsA = calculator.generateDynamicGrid(centerPrice, config, availableBalance);
      const levelsB = calculator.generateDynamicGrid(centerPrice, configWithout, availableBalance);

      expect(levelsA.map(l => l.price)).toEqual(levelsB.map(l => l.price));
    });
  });

  describe('generateDynamicGrid - validation', () => {
    it('should throw for levels less than 1', () => {
      const config: DynamicGridConfig = {
        levels: 0,
        spacingModel: 'linear',
        baseSpacing: 0.02,
        sizeModel: 'flat',
        baseSize: 50,
      };

      expect(() => calculator.generateDynamicGrid(100, config, 10000)).toThrow(
        'Grid levels must be between 1 and 10'
      );
    });

    it('should throw for levels greater than 10', () => {
      const config: DynamicGridConfig = {
        levels: 11,
        spacingModel: 'linear',
        baseSpacing: 0.02,
        sizeModel: 'flat',
        baseSize: 50,
      };

      expect(() => calculator.generateDynamicGrid(100, config, 10000)).toThrow(
        'Grid levels must be between 1 and 10'
      );
    });

    it('should throw for negative base spacing', () => {
      const config: DynamicGridConfig = {
        levels: 3,
        spacingModel: 'linear',
        baseSpacing: -0.01,
        sizeModel: 'flat',
        baseSize: 50,
      };

      expect(() => calculator.generateDynamicGrid(100, config, 10000)).toThrow(
        'Base spacing must be between 0 and 1'
      );
    });

    it('should throw for negative base size', () => {
      const config: DynamicGridConfig = {
        levels: 3,
        spacingModel: 'linear',
        baseSpacing: 0.02,
        sizeModel: 'flat',
        baseSize: -10,
      };

      expect(() => calculator.generateDynamicGrid(100, config, 10000)).toThrow(
        'Base size must be positive'
      );
    });

    it('should throw for negative volatility multiplier', () => {
      const config: DynamicGridConfig = {
        levels: 3,
        spacingModel: 'linear',
        baseSpacing: 0.02,
        sizeModel: 'flat',
        baseSize: 50,
        volatilityMultiplier: -1,
      };

      expect(() => calculator.generateDynamicGrid(100, config, 10000)).toThrow(
        'Volatility multiplier must be positive'
      );
    });
  });

  describe('generateDynamicGrid - 10 levels (20 total orders)', () => {
    it('should support maximum 10 levels per side', () => {
      const config: DynamicGridConfig = {
        levels: 10,
        spacingModel: 'linear',
        baseSpacing: 0.005,
        sizeModel: 'flat',
        baseSize: 20,
      };
      const centerPrice = 100;
      const availableBalance = 10000;

      const gridLevels = calculator.generateDynamicGrid(centerPrice, config, availableBalance);

      expect(gridLevels).toHaveLength(20);
      expect(gridLevels.filter(l => l.side === 'buy')).toHaveLength(10);
      expect(gridLevels.filter(l => l.side === 'sell')).toHaveLength(10);
    });
  });

  describe('generateDynamicGrid - minimum order value', () => {
    it('should enforce minimum order value', () => {
      const config: DynamicGridConfig = {
        levels: 2,
        spacingModel: 'linear',
        baseSpacing: 0.02,
        sizeModel: 'flat',
        baseSize: 1, // very small base size
      };
      const centerPrice = 100;
      const availableBalance = 10000;
      const minOrderValue = 5;

      const gridLevels = calculator.generateDynamicGrid(
        centerPrice,
        config,
        availableBalance,
        minOrderValue
      );

      // Each order's quote value should be at least the minimum
      for (const level of gridLevels) {
        const quoteValue = level.orderSize * level.price;
        expect(quoteValue).toBeGreaterThanOrEqual(minOrderValue - 0.01);
      }
    });
  });
});
