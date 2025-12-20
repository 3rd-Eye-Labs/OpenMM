/**
 * Price Calculator
 * Handles liquidity-weighted price calculations following buyback bot patterns
 */

import { LiquidityPool, PriceCalculationResult } from '../../types';

export class PriceCalculator {
  /**
   * Calculate liquidity-weighted price (exactly like buyback bot)
   * Weights each pool's price by its TVL relative to total liquidity
   */
  calculateLiquidityWeightedPrice(
    pools: LiquidityPool[],
    priceOverrides?: number[]
  ): PriceCalculationResult {
    if (pools.length === 0) {
      throw new Error('No pools provided for price calculation');
    }

    const validPools = pools.filter(pool => this.isValidPool(pool));
    if (validPools.length === 0) {
      throw new Error('No valid pools found for price calculation');
    }

    const totalTvl = validPools.reduce((sum, pool) => sum + Number(pool.state?.tvl ?? 0), 0);

    if (totalTvl === 0) {
      throw new Error('No liquidity available for price calculation');
    }

    const weightedPrice = validPools.reduce((weightedSum, pool, index) => {
      const weight = Number(pool.state?.tvl ?? 0) / totalTvl;
      const poolPrice = priceOverrides ? priceOverrides[index] : this.calculatePoolPrice(pool);
      return weightedSum + poolPrice * weight;
    }, 0);

    const confidence = this.calculateConfidence(validPools, totalTvl);

    return {
      price: weightedPrice,
      confidence,
      poolsUsed: validPools.length,
      totalLiquidity: totalTvl,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate price from individual pool reserves
   * Returns ADA per TOKEN (reserveB / reserveA)
   * reserveA = Token reserves, reserveB = ADA reserves
   */
  private calculatePoolPrice(pool: LiquidityPool): number {
    const { reserveA, reserveB } = pool.state!;

    if (!reserveA || !reserveB || reserveA === 0) {
      throw new Error(`Invalid pool reserves for ${pool.identifier}: A=${reserveA}, B=${reserveB}`);
    }

    return reserveB / reserveA;
  }

  /**
   * Calculate confidence score based on pool distribution and liquidity
   */
  private calculateConfidence(pools: LiquidityPool[], totalTvl: number): number {
    if (pools.length === 0) return 0;
    if (pools.length === 1) return 0.7;

    let confidence = Math.min(0.9, 0.5 + pools.length * 0.1);

    const topPoolTvl = Number(pools[0].state?.tvl ?? 0);
    const concentration = topPoolTvl / totalTvl;

    if (concentration > 0.8) {
      confidence *= 0.8;
    } else if (concentration > 0.6) {
      confidence *= 0.9;
    }

    return Math.max(confidence, 0.5);
  }

  /**
   * Validate pool has required data for price calculation
   */
  private isValidPool(pool: LiquidityPool): boolean {
    return !!(
      pool.state &&
      pool.state.tvl > 0 &&
      pool.state.reserveA > 0 &&
      pool.state.reserveB > 0 &&
      isFinite(pool.state.reserveA) &&
      isFinite(pool.state.reserveB) &&
      isFinite(pool.state.tvl)
    );
  }
}
