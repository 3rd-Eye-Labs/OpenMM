import { PriceCalculator } from '../../../../core/price-aggregation/price-calculator';
import { LiquidityPool } from '../../../../types';

describe('PriceCalculator', () => {
  let calculator: PriceCalculator;

  beforeEach(() => {
    calculator = new PriceCalculator();
  });

  describe('calculateLiquidityWeightedPrice', () => {
    it('should calculate correct weighted price for multiple pools', () => {
      const pools: LiquidityPool[] = [
        {
          dex: 'MinswapV2',
          identifier: 'pool1',
          state: {
            tvl: 1000000,
            reserveA: 1000000,
            reserveB: 500000,
          },
          isActive: true,
        },
        {
          dex: 'SundaeSwap',
          identifier: 'pool2',
          state: {
            tvl: 500000,
            reserveA: 500000,
            reserveB: 300000,
          },
          isActive: true,
        },
      ];

      const result = calculator.calculateLiquidityWeightedPrice(pools);

      expect(result.price).toBeCloseTo(0.533, 3);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.poolsUsed).toBe(2);
      expect(result.totalLiquidity).toBe(1500000);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should handle single pool correctly', () => {
      const pools: LiquidityPool[] = [
        {
          dex: 'MinswapV2',
          identifier: 'pool1',
          state: {
            tvl: 2000000,
            reserveA: 1000000,
            reserveB: 750000, // price = 0.75 ADA/token
          },
          isActive: true,
        },
      ];

      const result = calculator.calculateLiquidityWeightedPrice(pools);

      expect(result.price).toBeCloseTo(0.75, 3);
      expect(result.confidence).toBe(0.7); // Single pool confidence
      expect(result.poolsUsed).toBe(1);
      expect(result.totalLiquidity).toBe(2000000);
    });

    it('should filter out invalid pools', () => {
      const pools: LiquidityPool[] = [
        {
          dex: 'ValidPool',
          identifier: 'pool1',
          state: {
            tvl: 1000000,
            reserveA: 1000000,
            reserveB: 500000,
          },
          isActive: true,
        },
        {
          dex: 'InvalidPool',
          identifier: 'pool2',
          state: {
            tvl: 0,
            reserveA: 0,
            reserveB: 0,
          },
          isActive: true,
        },
        {
          dex: 'AnotherInvalid',
          identifier: 'pool3',
        },
      ];

      const result = calculator.calculateLiquidityWeightedPrice(pools);

      expect(result.poolsUsed).toBe(1);
      expect(result.price).toBe(0.5);
    });

    it('should throw error for empty pools array', () => {
      expect(() => {
        calculator.calculateLiquidityWeightedPrice([]);
      }).toThrow('No pools provided for price calculation');
    });

    it('should throw error when no valid pools found', () => {
      const invalidPools: LiquidityPool[] = [
        {
          dex: 'InvalidPool',
          identifier: 'pool1',
          state: {
            tvl: 0,
            reserveA: 0,
            reserveB: 0,
          },
        },
      ];

      expect(() => {
        calculator.calculateLiquidityWeightedPrice(invalidPools);
      }).toThrow('No valid pools found for price calculation');
    });

    it('should throw error when total liquidity is zero', () => {
      const pools: LiquidityPool[] = [
        {
          dex: 'ZeroLiquidity',
          identifier: 'pool1',
          state: {
            tvl: 0,
            reserveA: 1000000,
            reserveB: 500000,
          },
        },
      ];

      expect(() => {
        calculator.calculateLiquidityWeightedPrice(pools);
      }).toThrow('No valid pools found for price calculation');
    });

    it('should calculate higher confidence for more diverse pools', () => {
      const singlePool: LiquidityPool[] = [
        {
          dex: 'MinswapV2',
          identifier: 'pool1',
          state: { tvl: 1000000, reserveA: 1000000, reserveB: 500000 },
        },
      ];

      const multiplePools: LiquidityPool[] = [
        {
          dex: 'MinswapV2',
          identifier: 'pool1',
          state: { tvl: 600000, reserveA: 1000000, reserveB: 500000 },
        },
        {
          dex: 'SundaeSwap',
          identifier: 'pool2',
          state: { tvl: 400000, reserveA: 500000, reserveB: 250000 },
        },
      ];

      const singleResult = calculator.calculateLiquidityWeightedPrice(singlePool);
      const multipleResult = calculator.calculateLiquidityWeightedPrice(multiplePools);

      expect(multipleResult.confidence).toBeGreaterThanOrEqual(singleResult.confidence);
    });

    it('should reduce confidence for high concentration pools', () => {
      const highConcentration: LiquidityPool[] = [
        {
          dex: 'DominantPool',
          identifier: 'pool1',
          state: { tvl: 9000000, reserveA: 1000000, reserveB: 500000 },
        },
        {
          dex: 'SmallPool',
          identifier: 'pool2',
          state: { tvl: 1000000, reserveA: 500000, reserveB: 250000 },
        },
      ];

      const balanced: LiquidityPool[] = [
        {
          dex: 'Pool1',
          identifier: 'pool1',
          state: { tvl: 5000000, reserveA: 1000000, reserveB: 500000 },
        },
        {
          dex: 'Pool2',
          identifier: 'pool2',
          state: { tvl: 5000000, reserveA: 500000, reserveB: 250000 },
        },
      ];

      const concentratedResult = calculator.calculateLiquidityWeightedPrice(highConcentration);
      const balancedResult = calculator.calculateLiquidityWeightedPrice(balanced);

      expect(balancedResult.confidence).toBeGreaterThan(concentratedResult.confidence);
    });
  });

  describe('private method validation', () => {
    it('should validate pool data correctly', () => {
      const validPool: LiquidityPool = {
        dex: 'MinswapV2',
        identifier: 'pool1',
        state: {
          tvl: 1000000,
          reserveA: 1000000,
          reserveB: 500000,
        },
      };

      const invalidPools: LiquidityPool[] = [
        {
          dex: 'NoState',
          identifier: 'pool1',
        },
        {
          dex: 'ZeroTVL',
          identifier: 'pool2',
          state: { tvl: 0, reserveA: 1000000, reserveB: 500000 },
        },
        {
          dex: 'ZeroReserveA',
          identifier: 'pool3',
          state: { tvl: 1000000, reserveA: 0, reserveB: 500000 },
        },
        {
          dex: 'ZeroReserveB',
          identifier: 'pool4',
          state: { tvl: 1000000, reserveA: 1000000, reserveB: 0 },
        },
        {
          dex: 'InfiniteReserve',
          identifier: 'pool5',
          state: { tvl: 1000000, reserveA: Infinity, reserveB: 500000 },
        },
      ];

      expect(() => {
        calculator.calculateLiquidityWeightedPrice([validPool]);
      }).not.toThrow();
      invalidPools.forEach(pool => {
        expect(() => {
          calculator.calculateLiquidityWeightedPrice([pool]);
        }).toThrow();
      });
    });
  });
});
