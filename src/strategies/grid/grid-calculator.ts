import { GridLevel, DynamicGridConfig } from '../../types';

export class GridCalculator {
  /**
   * Generate a complete dynamic grid based on DynamicGridConfig.
   * This is the main entry point for dynamic order level generation.
   *
   * @param centerPrice - Current mid-market price to build grid around
   * @param config - Dynamic grid configuration (spacing model, size model, etc.)
   * @param availableBalance - Available balance in quote currency for sizing
   * @param minOrderValue - Minimum order value enforced by the exchange
   * @returns Array of GridLevel with calculated prices and order sizes
   */
  generateDynamicGrid(
    centerPrice: number,
    config: DynamicGridConfig,
    availableBalance: number,
    minOrderValue?: number
  ): GridLevel[] {
    this.validateConfig(config);

    const volatilityMultiplier = config.volatilityMultiplier ?? 1.0;

    const spacings = this.calculateSpacings(
      config.levels,
      config.spacingModel,
      config.baseSpacing,
      volatilityMultiplier,
      config.spacingFactor,
      config.customSpacings
    );

    const weights = this.calculateSizeWeights(config.levels, config.sizeModel, config.sizeWeights);

    const gridLevels = this.buildGridLevels(centerPrice, spacings);

    return this.assignDynamicOrderSizes(
      gridLevels,
      weights,
      config.baseSize,
      availableBalance,
      minOrderValue
    );
  }

  /**
   * Calculate cumulative spacing offsets for each level.
   * Returns an array where spacings[i] is the total offset from center for level i+1.
   *
   * For linear: [s, 2s, 3s, ...] (equal increments)
   * For geometric: [s, s*f, s*f^2, ...] (each level multiplied by factor)
   * For custom: user-provided cumulative offsets
   */
  calculateSpacings(
    levels: number,
    model: DynamicGridConfig['spacingModel'],
    baseSpacing: number,
    volatilityMultiplier: number = 1.0,
    spacingFactor?: number,
    customSpacings?: number[]
  ): number[] {
    let spacings: number[];

    switch (model) {
      case 'linear':
        spacings = this.calculateLinearSpacings(levels, baseSpacing);
        break;
      case 'geometric':
        spacings = this.calculateGeometricSpacings(levels, baseSpacing, spacingFactor ?? 1.3);
        break;
      case 'custom':
        if (!customSpacings || customSpacings.length !== levels) {
          throw new Error(
            `Custom spacing model requires exactly ${levels} spacing values, got ${customSpacings?.length ?? 0}`
          );
        }
        spacings = [...customSpacings];
        break;
      default:
        throw new Error(`Unsupported spacing model: ${model}`);
    }

    if (volatilityMultiplier !== 1.0) {
      spacings = spacings.map(s => s * volatilityMultiplier);
    }

    return spacings;
  }

  /**
   * Linear spacing: equal distance between each level.
   * Level 1 = baseSpacing, Level 2 = 2 * baseSpacing, etc.
   */
  private calculateLinearSpacings(levels: number, baseSpacing: number): number[] {
    const spacings: number[] = [];
    for (let i = 1; i <= levels; i++) {
      spacings.push(baseSpacing * i);
    }
    return spacings;
  }

  /**
   * Geometric spacing: each level's individual gap is multiplied by spacingFactor.
   * Level 1 gap = baseSpacing
   * Level 2 gap = baseSpacing * factor
   * Level 3 gap = baseSpacing * factor^2
   * Cumulative offsets are the running sum of these gaps.
   *
   * Example with baseSpacing=0.005, factor=1.5:
   *   Gaps:    [0.5%, 0.75%, 1.125%, 1.6875%]
   *   Cumul:   [0.5%, 1.25%, 2.375%, 4.0625%]
   */
  private calculateGeometricSpacings(
    levels: number,
    baseSpacing: number,
    spacingFactor: number
  ): number[] {
    const spacings: number[] = [];
    let cumulative = 0;
    for (let i = 0; i < levels; i++) {
      const gap = baseSpacing * Math.pow(spacingFactor, i);
      cumulative += gap;
      spacings.push(cumulative);
    }
    return spacings;
  }

  /**
   * Calculate size weight multipliers for each level.
   *
   * - flat: all weights = 1.0 (equal sizing)
   * - pyramidal: weights decrease from center outward (level 1 gets most, level N gets least)
   * - custom: user-provided weight multipliers
   */
  calculateSizeWeights(
    levels: number,
    model: DynamicGridConfig['sizeModel'],
    customWeights?: number[]
  ): number[] {
    switch (model) {
      case 'flat':
        return new Array(levels).fill(1.0);

      case 'pyramidal': {
        // Weights decrease linearly: level 1 = levels, level 2 = levels-1, ..., level N = 1
        // Then normalize so they sum to `levels` (preserving total capital allocation)
        const rawWeights: number[] = [];
        for (let i = 0; i < levels; i++) {
          rawWeights.push(levels - i);
        }
        const sum = rawWeights.reduce((a, b) => a + b, 0);
        const normFactor = levels / sum;
        return rawWeights.map(w => w * normFactor);
      }

      case 'custom':
        if (!customWeights || customWeights.length !== levels) {
          throw new Error(
            `Custom size model requires exactly ${levels} weight values, got ${customWeights?.length ?? 0}`
          );
        }
        return [...customWeights];

      default:
        throw new Error(`Unsupported size model: ${model}`);
    }
  }

  /**
   * Build grid levels from center price and spacing offsets.
   * Creates both buy (below center) and sell (above center) levels.
   */
  private buildGridLevels(centerPrice: number, spacings: number[]): GridLevel[] {
    const gridLevels: GridLevel[] = [];

    for (const spacing of spacings) {
      gridLevels.push({
        price: centerPrice * (1 - spacing),
        side: 'buy',
        orderSize: 0,
      });

      gridLevels.push({
        price: centerPrice * (1 + spacing),
        side: 'sell',
        orderSize: 0,
      });
    }

    return gridLevels;
  }

  /**
   * Assign order sizes to grid levels using weight multipliers.
   *
   * The baseSize is the per-level order size in quote currency.
   * Weights scale individual levels relative to baseSize.
   * Total allocation is capped at 80% of available balance.
   */
  private assignDynamicOrderSizes(
    gridLevels: GridLevel[],
    weights: number[],
    baseSize: number,
    availableBalance: number,
    minOrderValue?: number
  ): GridLevel[] {
    // Total desired allocation = sum of (baseSize * weight) for each side
    const totalWeightedSize = weights.reduce((sum, w) => sum + w, 0) * baseSize * 2; // *2 for buy+sell
    const maxAllocation = availableBalance * 0.8;

    // Scale factor to ensure we don't exceed available balance
    const scaleFactor = totalWeightedSize > maxAllocation ? maxAllocation / totalWeightedSize : 1.0;

    return gridLevels.map((level, index) => {
      const weightIndex = Math.floor(index / 2);
      const weight = weights[weightIndex];
      const sizeInQuote = baseSize * weight * scaleFactor;

      const effectiveSize = minOrderValue ? Math.max(sizeInQuote, minOrderValue) : sizeInQuote;

      return {
        ...level,
        orderSize: effectiveSize / level.price,
      };
    });
  }

  /**
   * Validate dynamic grid configuration
   */
  private validateConfig(config: DynamicGridConfig): void {
    if (config.levels < 1 || config.levels > 10) {
      throw new Error(`Grid levels must be between 1 and 10, got ${config.levels}`);
    }

    if (config.baseSpacing <= 0 || config.baseSpacing >= 1) {
      throw new Error(
        `Base spacing must be between 0 and 1 (exclusive), got ${config.baseSpacing}`
      );
    }

    if (config.baseSize <= 0) {
      throw new Error(`Base size must be positive, got ${config.baseSize}`);
    }

    if (config.spacingModel === 'geometric') {
      const factor = config.spacingFactor ?? 1.3;
      if (factor <= 0) {
        throw new Error(`Spacing factor must be positive, got ${factor}`);
      }
    }

    if (config.spacingModel === 'custom') {
      if (!config.customSpacings || config.customSpacings.length !== config.levels) {
        throw new Error(`Custom spacing model requires exactly ${config.levels} spacing values`);
      }
      for (let i = 0; i < config.customSpacings.length; i++) {
        if (config.customSpacings[i] <= 0) {
          throw new Error(`Custom spacing at index ${i} must be positive`);
        }
        if (i > 0 && config.customSpacings[i] <= config.customSpacings[i - 1]) {
          throw new Error(`Custom spacings must be in increasing order`);
        }
      }
    }

    if (config.sizeModel === 'custom') {
      if (!config.sizeWeights || config.sizeWeights.length !== config.levels) {
        throw new Error(`Custom size model requires exactly ${config.levels} weight values`);
      }
      for (let i = 0; i < config.sizeWeights.length; i++) {
        if (config.sizeWeights[i] <= 0) {
          throw new Error(`Size weight at index ${i} must be positive`);
        }
      }
    }

    if (config.volatilityMultiplier !== undefined && config.volatilityMultiplier <= 0) {
      throw new Error(`Volatility multiplier must be positive, got ${config.volatilityMultiplier}`);
    }
  }
}
