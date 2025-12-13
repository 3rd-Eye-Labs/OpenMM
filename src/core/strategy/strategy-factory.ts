import { BaseStrategy } from './base-strategy';
import { BaseExchangeConnector } from '../exchange/base-exchange-connector';
import { GridStrategy } from '../../strategies/grid/grid-strategy';
import { GridStrategyConfig, GridConfig } from '../../types';
import { LauncherConfig, GridLauncherParams, DEFAULT_GRID_PARAMS } from '../../config/launcher-config';
import { toStandardFormat } from '../../utils/symbol-utils';
import { ExchangeFactory, SupportedExchange } from '../../cli/exchange-factory';

export class StrategyFactory {
  static async create(
    config: LauncherConfig,
    params?: GridLauncherParams
  ): Promise<BaseStrategy> {
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
    
    const gridConfig: GridConfig = {
      symbol: normalizedSymbol,
      gridLevels: gridParams.gridLevels!,
      gridSpacing: gridParams.gridSpacing!,
      orderSize: gridParams.orderSize!,
      minConfidence: gridParams.minConfidence!,
      priceDeviationThreshold: gridParams.priceDeviationThreshold!,
      adjustmentDebounce: gridParams.adjustmentDebounce!
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
        lowerPrice: 0
      }
    };

    const strategy = new GridStrategy(strategyConfig.id);
    strategy.setExchangeConnector(exchange);
    
    await strategy.initialize(strategyConfig);

    return strategy;
  }
}