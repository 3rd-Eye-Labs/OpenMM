import { StrategyFactory } from '../../../../core/strategy/strategy-factory';
import { GridStrategy } from '../../../../strategies/grid/grid-strategy';
import { ExchangeFactory } from '../../../../cli/exchange-factory';
import { BaseExchangeConnector } from '../../../../core/exchange/base-exchange-connector';
jest.mock('../../../../cli/exchange-factory');
jest.mock('../../../../strategies/grid/grid-strategy');
jest.mock('../../../../utils/symbol-utils', () => ({
  toStandardFormat: jest.fn((symbol: string) => {
    if (symbol.includes('/')) return symbol;
    return symbol.replace(/USDT$/, '/USDT');
  }),
}));
const mockExchangeFactory = ExchangeFactory as jest.Mocked<typeof ExchangeFactory>;
const MockGridStrategy = GridStrategy as jest.MockedClass<typeof GridStrategy>;
describe('StrategyFactory', () => {
  let mockExchange: jest.Mocked<BaseExchangeConnector>;
  let mockStrategy: jest.Mocked<GridStrategy>;
  beforeEach(() => {
    jest.clearAllMocks();
    mockExchange = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      cancelOrder: jest.fn(),
    } as any;
    mockStrategy = {
      initialize: jest.fn(),
      setExchangeConnector: jest.fn(),
      setRiskConfig: jest.fn(),
    } as any;
    mockExchangeFactory.isSupported.mockReturnValue(true);
    mockExchangeFactory.getExchange.mockResolvedValue(mockExchange);
    mockExchangeFactory.getSupportedExchanges.mockReturnValue(['mexc']);
    MockGridStrategy.mockImplementation(() => mockStrategy);
  });
  describe('create method - main branches', () => {
    it('should throw error for unsupported exchange', async () => {
      mockExchangeFactory.isSupported.mockReturnValue(false);
      mockExchangeFactory.getSupportedExchanges.mockReturnValue(['mexc']);
      const config = {
        exchange: 'unsupported-exchange',
        strategy: 'grid',
        symbol: 'BTCUSDT',
      };
      await expect(StrategyFactory.create(config)).rejects.toThrow(
        'Unsupported exchange: unsupported-exchange. Supported: mexc'
      );
    });
    it('should throw error for unsupported strategy', async () => {
      const config = {
        exchange: 'mexc',
        strategy: 'unsupported',
        symbol: 'BTCUSDT',
      };
      await expect(StrategyFactory.create(config)).rejects.toThrow(
        'Unsupported strategy: unsupported. Supported: grid'
      );
    });
    it('should successfully create grid strategy - main path', async () => {
      const config = {
        exchange: 'mexc',
        strategy: 'grid',
        symbol: 'BTCUSDT',
      };
      const result = await StrategyFactory.create(config);
      expect(mockExchangeFactory.isSupported).toHaveBeenCalledWith('mexc');
      expect(mockExchangeFactory.getExchange).toHaveBeenCalledWith('mexc');
      expect(MockGridStrategy).toHaveBeenCalled();
      expect(mockStrategy.setExchangeConnector).toHaveBeenCalledWith(mockExchange);
      expect(mockStrategy.initialize).toHaveBeenCalled();
      expect(result).toBe(mockStrategy);
    });
    it('should handle case-insensitive strategy names', async () => {
      const configs = [
        { exchange: 'mexc', strategy: 'GRID', symbol: 'BTCUSDT' },
        { exchange: 'mexc', strategy: 'Grid', symbol: 'BTCUSDT' },
        { exchange: 'mexc', strategy: 'grid', symbol: 'BTCUSDT' },
      ];
      for (const config of configs) {
        await expect(StrategyFactory.create(config)).resolves.toBe(mockStrategy);
      }
    });
  });
  describe('createGridStrategy - risk config branches', () => {
    it('should set risk config when both maxPositionSize and safetyReservePercentage provided', async () => {
      const config = { exchange: 'mexc', strategy: 'grid', symbol: 'BTCUSDT' };
      const params = {
        maxPositionSize: 0.9,
        safetyReservePercentage: 0.1,
      };
      await StrategyFactory.create(config, params);
      expect(mockStrategy.setRiskConfig).toHaveBeenCalledWith({
        maxPositionSize: 0.9,
        safetyReservePercentage: 0.1,
        minConfidence: 0.6,
      });
    });
    it('should set risk config when only maxPositionSize provided', async () => {
      const config = { exchange: 'mexc', strategy: 'grid', symbol: 'BTCUSDT' };
      const params = { maxPositionSize: 0.9 };
      await StrategyFactory.create(config, params);
      expect(mockStrategy.setRiskConfig).toHaveBeenCalledWith({
        maxPositionSize: 0.9,
        safetyReservePercentage: 0.2,
        minConfidence: 0.6,
      });
    });
    it('should set risk config when only safetyReservePercentage provided', async () => {
      const config = { exchange: 'mexc', strategy: 'grid', symbol: 'BTCUSDT' };
      const params = { safetyReservePercentage: 0.15 };
      await StrategyFactory.create(config, params);
      expect(mockStrategy.setRiskConfig).toHaveBeenCalledWith({
        maxPositionSize: 0.8,
        safetyReservePercentage: 0.15,
        minConfidence: 0.6,
      });
    });
    it('should set risk config with defaults when neither parameter explicitly provided', async () => {
      const config = { exchange: 'mexc', strategy: 'grid', symbol: 'BTCUSDT' };
      const params = {
        gridLevels: 5,
        orderSize: 100,
      };
      await StrategyFactory.create(config, params);
      expect(mockStrategy.setRiskConfig).toHaveBeenCalledWith({
        maxPositionSize: 0.8,
        safetyReservePercentage: 0.2,
        minConfidence: 0.6,
      });
    });
    it('should NOT set risk config when both are undefined', async () => {
      const config = { exchange: 'mexc', strategy: 'grid', symbol: 'BTCUSDT' };
      const params = {
        maxPositionSize: undefined,
        safetyReservePercentage: undefined,
        gridLevels: 5,
      };
      await StrategyFactory.create(config, params);
      expect(mockStrategy.setRiskConfig).not.toHaveBeenCalled();
    });
  });
  describe('parameter merging branches', () => {
    it('should merge custom parameters with defaults', async () => {
      const config = { exchange: 'mexc', strategy: 'grid', symbol: 'BTCUSDT' };
      const params = {
        gridLevels: 8,
        orderSize: 75,
        gridSpacing: 0.025,
      };
      await StrategyFactory.create(config, params);
      expect(MockGridStrategy).toHaveBeenCalled();
      expect(mockStrategy.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          gridConfig: expect.objectContaining({
            gridLevels: 8,
            orderSize: 75,
            gridSpacing: 0.025,
          }),
        })
      );
    });
    it('should use defaults when no params provided', async () => {
      const config = { exchange: 'mexc', strategy: 'grid', symbol: 'BTCUSDT' };
      await StrategyFactory.create(config);
      expect(mockStrategy.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          gridConfig: expect.objectContaining({
            gridLevels: 5,
            orderSize: 50,
            gridSpacing: 0.02,
          }),
        })
      );
    });
    it('should handle partial parameter override', async () => {
      const config = { exchange: 'mexc', strategy: 'grid', symbol: 'BTCUSDT' };
      const params = {
        gridLevels: 10,
      };
      await StrategyFactory.create(config, params);
      expect(mockStrategy.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          gridConfig: expect.objectContaining({
            gridLevels: 10,
            orderSize: 50,
            gridSpacing: 0.02,
          }),
        })
      );
    });
  });
  describe('error handling', () => {
    it('should handle exchange factory errors', async () => {
      mockExchangeFactory.getExchange.mockRejectedValue(new Error('Exchange connection failed'));
      const config = { exchange: 'mexc', strategy: 'grid', symbol: 'BTCUSDT' };
      await expect(StrategyFactory.create(config)).rejects.toThrow('Exchange connection failed');
    });
    it('should handle strategy initialization errors', async () => {
      mockStrategy.initialize.mockRejectedValue(new Error('Initialization failed'));
      const config = { exchange: 'mexc', strategy: 'grid', symbol: 'BTCUSDT' };
      await expect(StrategyFactory.create(config)).rejects.toThrow('Initialization failed');
    });
  });
  describe('symbol processing', () => {
    it('should handle symbol normalization', async () => {
      const { toStandardFormat } = jest.requireMock('../../../../utils/symbol-utils');
      const config = { exchange: 'mexc', strategy: 'grid', symbol: 'BTCUSDT' };
      await StrategyFactory.create(config);
      expect(toStandardFormat).toHaveBeenCalledWith('BTCUSDT');
    });
    it('should create strategy ID with normalized symbol', async () => {
      const config = { exchange: 'mexc', strategy: 'grid', symbol: 'BTC/USDT' };
      await StrategyFactory.create(config);
      expect(MockGridStrategy).toHaveBeenCalledWith(expect.stringMatching(/^grid-BTCUSDT-\d+$/));
    });
  });
});
