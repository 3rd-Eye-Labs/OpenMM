export interface LauncherConfig {
  exchange: string;
  strategy: string;
  symbol: string;
}

export interface GridLauncherParams {
  gridLevels?: number;
  gridSpacing?: number;
  orderSize?: number;
  minConfidence?: number;
  priceDeviationThreshold?: number;
  adjustmentDebounce?: number;
  maxPositionSize?: number;
  safetyReservePercentage?: number;
}

export const DEFAULT_GRID_PARAMS: GridLauncherParams = {
  gridLevels: 5,
  gridSpacing: 0.02,
  orderSize: 50,
  minConfidence: 0.6,
  priceDeviationThreshold: 0.015,
  adjustmentDebounce: 2000,
  maxPositionSize: 0.8,
  safetyReservePercentage: 0.2,
};
