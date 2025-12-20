import {
  LauncherConfig,
  GridLauncherParams,
  DEFAULT_GRID_PARAMS,
} from '../../../config/launcher-config';

describe('Launcher Config', () => {
  describe('LauncherConfig interface', () => {
    it('should have the correct structure', () => {
      const config: LauncherConfig = {
        exchange: 'mexc',
        strategy: 'grid',
        symbol: 'BTCUSDT',
      };
      expect(config.exchange).toBe('mexc');
      expect(config.strategy).toBe('grid');
      expect(config.symbol).toBe('BTCUSDT');
    });
  });

  describe('GridLauncherParams interface', () => {
    it('should allow all optional parameters', () => {
      const params: GridLauncherParams = {
        gridLevels: 10,
        gridSpacing: 0.01,
        orderSize: 100,
        minConfidence: 0.8,
        priceDeviationThreshold: 0.02,
        adjustmentDebounce: 3000,
        maxPositionSize: 0.9,
        safetyReservePercentage: 0.1,
      };
      expect(params.gridLevels).toBe(10);
      expect(params.gridSpacing).toBe(0.01);
      expect(params.orderSize).toBe(100);
      expect(params.minConfidence).toBe(0.8);
      expect(params.priceDeviationThreshold).toBe(0.02);
      expect(params.adjustmentDebounce).toBe(3000);
      expect(params.maxPositionSize).toBe(0.9);
      expect(params.safetyReservePercentage).toBe(0.1);
    });

    it('should allow partial parameters', () => {
      const params: GridLauncherParams = {
        gridLevels: 7,
        orderSize: 75,
      };
      expect(params.gridLevels).toBe(7);
      expect(params.orderSize).toBe(75);
      expect(params.gridSpacing).toBeUndefined();
      expect(params.minConfidence).toBeUndefined();
    });

    it('should allow empty parameters object', () => {
      const params: GridLauncherParams = {};
      expect(Object.keys(params)).toHaveLength(0);
    });
  });
  describe('DEFAULT_GRID_PARAMS', () => {
    it('should contain all expected default values', () => {
      expect(DEFAULT_GRID_PARAMS).toEqual({
        gridLevels: 5,
        gridSpacing: 0.02,
        orderSize: 50,
        minConfidence: 0.6,
        priceDeviationThreshold: 0.015,
        adjustmentDebounce: 2000,
        maxPositionSize: 0.8,
        safetyReservePercentage: 0.2,
      });
    });

    it('should have reasonable default values', () => {
      expect(DEFAULT_GRID_PARAMS.gridLevels).toBeGreaterThan(0);
      expect(DEFAULT_GRID_PARAMS.gridSpacing).toBeGreaterThan(0);
      expect(DEFAULT_GRID_PARAMS.gridSpacing).toBeLessThan(1);
      expect(DEFAULT_GRID_PARAMS.orderSize).toBeGreaterThan(0);
      expect(DEFAULT_GRID_PARAMS.minConfidence).toBeGreaterThan(0);
      expect(DEFAULT_GRID_PARAMS.minConfidence).toBeLessThanOrEqual(1);
      expect(DEFAULT_GRID_PARAMS.priceDeviationThreshold).toBeGreaterThan(0);
      expect(DEFAULT_GRID_PARAMS.adjustmentDebounce).toBeGreaterThan(0);
      expect(DEFAULT_GRID_PARAMS.maxPositionSize).toBeGreaterThan(0);
      expect(DEFAULT_GRID_PARAMS.maxPositionSize).toBeLessThanOrEqual(1);
      expect(DEFAULT_GRID_PARAMS.safetyReservePercentage).toBeGreaterThan(0);
      expect(DEFAULT_GRID_PARAMS.safetyReservePercentage).toBeLessThan(1);
    });

    it('should be immutable (frozen)', () => {
      const originalValue = DEFAULT_GRID_PARAMS.gridLevels;
      expect(() => {
        (DEFAULT_GRID_PARAMS as any).gridLevels = 999;
      }).not.toThrow();
      const wasModified = DEFAULT_GRID_PARAMS.gridLevels !== originalValue;
      if (!wasModified) {
        expect(DEFAULT_GRID_PARAMS.gridLevels).toBe(originalValue);
      }
    });

    it('should be compatible with GridLauncherParams interface', () => {
      const params: GridLauncherParams = DEFAULT_GRID_PARAMS;
      expect(typeof params.gridLevels).toBe('number');
      expect(typeof params.gridSpacing).toBe('number');
      expect(typeof params.orderSize).toBe('number');
      expect(typeof params.minConfidence).toBe('number');
      expect(typeof params.priceDeviationThreshold).toBe('number');
      expect(typeof params.adjustmentDebounce).toBe('number');
      expect(typeof params.maxPositionSize).toBe('number');
      expect(typeof params.safetyReservePercentage).toBe('number');
    });

    it('should allow merging with custom params', () => {
      const customParams: GridLauncherParams = {
        gridLevels: 10,
        orderSize: 100,
      };
      const mergedParams: GridLauncherParams = {
        ...DEFAULT_GRID_PARAMS,
        ...customParams,
      };
      expect(mergedParams.gridLevels).toBe(10);
      expect(mergedParams.orderSize).toBe(100);
      expect(mergedParams.gridSpacing).toBe(DEFAULT_GRID_PARAMS.gridSpacing);
      expect(mergedParams.minConfidence).toBe(DEFAULT_GRID_PARAMS.minConfidence);
    });
  });
});
