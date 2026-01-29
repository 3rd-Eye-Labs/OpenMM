import { BaseStrategy } from './base-strategy';
import { BaseExchangeConnector } from '../exchange/base-exchange-connector';
import { GridStrategy } from '../../strategies/grid/grid-strategy';
import {
  GridStrategyConfig,
  GridConfig,
  DynamicGridConfig,
  GridProfile,
  VolatilityConfig,
} from '../../types';
import {
  LauncherConfig,
  GridLauncherParams,
  DEFAULT_GRID_PARAMS,
} from '../../config/launcher-config';
import { toStandardFormat } from '../../utils/symbol-utils';
import { ExchangeFactory, SupportedExchange } from '../../cli/exchange-factory';
import * as fs from 'fs';
import * as path from 'path';

export class StrategyFactory {
  static async create(config: LauncherConfig, params?: GridLauncherParams): Promise<BaseStrategy> {
    if (!ExchangeFactory.isSupported(config.exchange)) {
      const supported = ExchangeFactory.getSupportedExchanges().join(', ');
      throw new Error(`Unsupported exchange: ${config.exchange}. Supported: ${supported}`);
    }

    const exchange = await ExchangeFactory.getExchange(config.exchange as SupportedExchange);

    switch (config.strategy.toLowerCase()) {
      case 'grid':
        return this.createGridStrategy(config, exchange, params);
      default:
        throw new Error(`Unsupported strategy: ${config.strategy}. Supported: grid`);
    }
  }

  private static async createGridStrategy(
    config: LauncherConfig,
    exchange: BaseExchangeConnector,
    params?: GridLauncherParams
  ): Promise<GridStrategy> {
    const normalizedSymbol = toStandardFormat(config.symbol);
    const gridParams = { ...DEFAULT_GRID_PARAMS, ...params };

    if (gridParams.gridProfilePath) {
      const profile = this.loadGridProfile(gridParams.gridProfilePath);
      Object.assign(gridParams, {
        gridLevels: profile.levels,
        gridSpacing: profile.baseSpacing,
        orderSize: profile.baseSize,
        spacingModel: profile.spacingModel,
        spacingFactor: profile.spacingFactor,
        customSpacings: profile.customSpacings,
        sizeModel: profile.sizeModel,
        sizeWeights: profile.sizeWeights,
      });
    }

    // Build dynamic grid config
    const dynamicGrid: DynamicGridConfig = {
      levels: gridParams.gridLevels!,
      spacingModel: gridParams.spacingModel ?? 'linear',
      baseSpacing: gridParams.gridSpacing!,
      spacingFactor: gridParams.spacingFactor,
      customSpacings: gridParams.customSpacings,
      sizeModel: gridParams.sizeModel ?? 'flat',
      baseSize: gridParams.orderSize!,
      sizeWeights: gridParams.sizeWeights,
    };

    // Build volatility config if enabled
    let volatilityConfig: VolatilityConfig | undefined;
    if (gridParams.volatilityEnabled) {
      volatilityConfig = {
        enabled: true,
        windowSize: gridParams.volatilityWindowSize ?? 10,
        lowThreshold: gridParams.volatilityLowThreshold ?? 0.02,
        highThreshold: gridParams.volatilityHighThreshold ?? 0.05,
        lowMultiplier: gridParams.volatilityLowMultiplier ?? 1.5,
        highMultiplier: gridParams.volatilityHighMultiplier ?? 2.0,
      };
    }

    const gridConfig: GridConfig = {
      symbol: normalizedSymbol,
      gridLevels: gridParams.gridLevels!,
      gridSpacing: gridParams.gridSpacing!,
      orderSize: gridParams.orderSize!,
      minConfidence: gridParams.minConfidence!,
      priceDeviationThreshold: gridParams.priceDeviationThreshold!,
      adjustmentDebounce: gridParams.adjustmentDebounce!,
      dynamicGrid,
      volatilityConfig,
    };

    const strategyConfig: GridStrategyConfig = {
      id: `${config.strategy}-${normalizedSymbol.replace('/', '')}-${Date.now()}`,
      type: 'grid',
      symbol: normalizedSymbol,
      exchange: config.exchange,
      accountId: 'main',
      enabled: true,
      gridConfig,
      parameters: {
        gridLevels: gridConfig.gridLevels,
        gridSpacing: gridConfig.gridSpacing,
        orderSize: gridConfig.orderSize,
        upperPrice: 999999,
        lowerPrice: 0,
      },
    };

    const strategy = new GridStrategy(strategyConfig.id);
    strategy.setExchangeConnector(exchange);

    if (
      gridParams.maxPositionSize !== undefined ||
      gridParams.safetyReservePercentage !== undefined
    ) {
      strategy.setRiskConfig({
        maxPositionSize: gridParams.maxPositionSize ?? 0.8,
        safetyReservePercentage: gridParams.safetyReservePercentage ?? 0.2,
        minConfidence: gridParams.minConfidence ?? 0.6,
      });
    }

    await strategy.initialize(strategyConfig);

    return strategy;
  }

  /**
   * Load and validate a grid profile from a JSON file.
   * Profile files allow users to define full grid configurations externally.
   */
  private static loadGridProfile(profilePath: string): GridProfile {
    const resolvedPath = path.resolve(profilePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Grid profile file not found: ${resolvedPath}`);
    }

    try {
      const content = fs.readFileSync(resolvedPath, 'utf-8');
      const profile = JSON.parse(content) as GridProfile;

      if (!profile.levels || profile.levels < 1 || profile.levels > 10) {
        throw new Error(`Profile levels must be between 1 and 10, got ${profile.levels}`);
      }

      if (!profile.baseSpacing || profile.baseSpacing <= 0) {
        throw new Error(`Profile baseSpacing must be positive`);
      }

      if (!profile.baseSize || profile.baseSize <= 0) {
        throw new Error(`Profile baseSize must be positive`);
      }

      const validSpacingModels = ['linear', 'geometric', 'custom'];
      if (!validSpacingModels.includes(profile.spacingModel)) {
        throw new Error(`Profile spacingModel must be one of: ${validSpacingModels.join(', ')}`);
      }

      const validSizeModels = ['flat', 'pyramidal', 'custom'];
      if (!validSizeModels.includes(profile.sizeModel)) {
        throw new Error(`Profile sizeModel must be one of: ${validSizeModels.join(', ')}`);
      }

      if (profile.spacingModel === 'custom') {
        if (!profile.customSpacings || profile.customSpacings.length !== profile.levels) {
          throw new Error(
            `Custom spacing model requires exactly ${profile.levels} customSpacings entries`
          );
        }
      }

      if (profile.sizeModel === 'custom') {
        if (!profile.sizeWeights || profile.sizeWeights.length !== profile.levels) {
          throw new Error(
            `Custom size model requires exactly ${profile.levels} sizeWeights entries`
          );
        }
      }

      return profile;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in grid profile: ${resolvedPath}`);
      }
      throw error;
    }
  }
}
