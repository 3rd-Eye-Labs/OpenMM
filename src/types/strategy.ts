import { DynamicGridConfig } from './grid';

/**
 * Strategy types supported by OpenMM
 */
export type StrategyType = 'grid';

/**
 * Strategy execution status
 */
export type StrategyStatus = 'idle' | 'running' | 'stopped' | 'error';

/**
 * Basic strategy configuration
 */
export interface StrategyConfig {
  id: string;
  type: StrategyType;
  symbol: string;
  exchange: string;
  accountId: string;
  enabled: boolean;
}

/**
 * Grid configuration
 */
export interface GridConfig {
  symbol: string;
  gridLevels: number;
  gridSpacing: number;
  orderSize: number;
  minConfidence: number;
  priceDeviationThreshold: number;
  adjustmentDebounce: number;
  /** Dynamic grid configuration for advanced order level generation */
  dynamicGrid?: DynamicGridConfig;
}

/**
 * Grid strategy specific configuration
 */
export interface GridStrategyConfig extends StrategyConfig {
  type: 'grid';
  gridConfig: GridConfig;
  parameters: {
    gridLevels: number;
    gridSpacing: number;
    orderSize: number;
    upperPrice: number;
    lowerPrice: number;
  };
}
