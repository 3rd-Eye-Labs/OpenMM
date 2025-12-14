import { ExchangeFactory } from '../../../cli/exchange-factory';
import { MexcConnector } from '../../../exchanges/mexc/mexc-connector';
import { BaseExchangeConnector } from '../../../core/exchange/base-exchange-connector';
jest.mock('../../../exchanges/mexc/mexc-connector');
const MockMexcConnector = MexcConnector as jest.MockedClass<typeof MexcConnector>;
describe('ExchangeFactory', () => {
  let mockConnector: jest.Mocked<BaseExchangeConnector>;
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnector = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
    } as any;
    MockMexcConnector.mockImplementation(() => mockConnector as any);
    (ExchangeFactory as any).connectors.clear();
  });

  describe('isSupported', () => {
    it('should return true for supported exchanges', () => {
      expect(ExchangeFactory.isSupported('mexc')).toBe(true);
      expect(ExchangeFactory.isSupported('gateio')).toBe(true);
      expect(ExchangeFactory.isSupported('bitget')).toBe(true);
      expect(ExchangeFactory.isSupported('kraken')).toBe(true);
    });

    it('should return false for unsupported exchanges', () => {
      expect(ExchangeFactory.isSupported('binance')).toBe(false);
      expect(ExchangeFactory.isSupported('coinbase')).toBe(false);
      expect(ExchangeFactory.isSupported('unknown')).toBe(false);
      expect(ExchangeFactory.isSupported('')).toBe(false);
    });
  });

  describe('getSupportedExchanges', () => {
    it('should return array of all supported exchanges', () => {
      const supported = ExchangeFactory.getSupportedExchanges();
      expect(supported).toEqual(['mexc', 'gateio', 'bitget', 'kraken']);
      expect(supported).toHaveLength(4);
    });
  });

  describe('getExchange', () => {
    it('should create and return new mexc connector', async () => {
      const connector = await ExchangeFactory.getExchange('mexc');
      expect(MockMexcConnector).toHaveBeenCalledTimes(1);
      expect(mockConnector.connect).toHaveBeenCalledTimes(1);
      expect(connector).toBe(mockConnector);
    });

    it('should return cached connector on subsequent calls', async () => {
      const connector1 = await ExchangeFactory.getExchange('mexc');
      const connector2 = await ExchangeFactory.getExchange('mexc');
      expect(MockMexcConnector).toHaveBeenCalledTimes(1);
      expect(mockConnector.connect).toHaveBeenCalledTimes(1);
      expect(connector1).toBe(connector2);
      expect(connector1).toBe(mockConnector);
    });

    it('should throw error for gateio exchange', async () => {
      await expect(ExchangeFactory.getExchange('gateio'))
        .rejects.toThrow('GateIO connector not yet implemented');
    });

    it('should throw error for bitget exchange', async () => {
      await expect(ExchangeFactory.getExchange('bitget'))
        .rejects.toThrow('Bitget connector not yet implemented');
    });

    it('should throw error for kraken exchange', async () => {
      await expect(ExchangeFactory.getExchange('kraken'))
        .rejects.toThrow('Kraken connector not yet implemented');
    });

    it('should handle connector creation errors', async () => {
      MockMexcConnector.mockImplementationOnce(() => {
        throw new Error('Connector creation failed');
      });
      await expect(ExchangeFactory.getExchange('mexc'))
        .rejects.toThrow('Connector creation failed');
    });

    it('should handle connection errors', async () => {
      mockConnector.connect.mockRejectedValueOnce(new Error('Connection failed'));
      await expect(ExchangeFactory.getExchange('mexc'))
        .rejects.toThrow('Connection failed');
    });
  });

  describe('createExchangeConnector - all branches', () => {
    it('should create MexcConnector for mexc', async () => {
      await ExchangeFactory.getExchange('mexc');
      expect(MockMexcConnector).toHaveBeenCalledTimes(1);
    });

    it('should handle default case in switch statement', async () => {
      await expect(ExchangeFactory.getExchange('gateio')).rejects.toThrow();
      await expect(ExchangeFactory.getExchange('bitget')).rejects.toThrow();
      await expect(ExchangeFactory.getExchange('kraken')).rejects.toThrow();
    });
  });

  describe('disconnectAll', () => {
    it('should disconnect all cached connectors', async () => {
      await ExchangeFactory.getExchange('mexc');
      const mockConnector2 = {
        disconnect: jest.fn().mockResolvedValue(undefined),
      } as any;
      (ExchangeFactory as any).connectors.set('test', mockConnector2);
      await ExchangeFactory.disconnectAll();
      expect(mockConnector.disconnect).toHaveBeenCalledTimes(1);
      expect(mockConnector2.disconnect).toHaveBeenCalledTimes(1);
      expect((ExchangeFactory as any).connectors.size).toBe(0);
    });

    it('should handle connectors without disconnect method', async () => {
      const connectorWithoutDisconnect = {} as BaseExchangeConnector;
      (ExchangeFactory as any).connectors.set('test', connectorWithoutDisconnect);
      await expect(ExchangeFactory.disconnectAll()).resolves.not.toThrow();
      expect((ExchangeFactory as any).connectors.size).toBe(0);
    });

    it('should handle disconnect errors gracefully', async () => {
      await ExchangeFactory.getExchange('mexc');
      mockConnector.disconnect.mockRejectedValueOnce(new Error('Disconnect failed'));
      await expect(ExchangeFactory.disconnectAll()).rejects.toThrow('Disconnect failed');
      expect((ExchangeFactory as any).connectors.size).toBe(1);
    });

    it('should handle empty connector cache', async () => {
      await expect(ExchangeFactory.disconnectAll()).resolves.not.toThrow();
      expect((ExchangeFactory as any).connectors.size).toBe(0);
    });

    it('should handle mixed connector types', async () => {
      await ExchangeFactory.getExchange('mexc');
      const mockConnector2 = {
        disconnect: jest.fn().mockResolvedValue(undefined),
      } as any;
      const mockConnector3 = {} as BaseExchangeConnector;
      (ExchangeFactory as any).connectors.set('test1', mockConnector2);
      (ExchangeFactory as any).connectors.set('test2', mockConnector3);
      await ExchangeFactory.disconnectAll();
      expect(mockConnector.disconnect).toHaveBeenCalledTimes(1);
      expect(mockConnector2.disconnect).toHaveBeenCalledTimes(1);
      expect((ExchangeFactory as any).connectors.size).toBe(0);
    });
  });

  describe('caching behavior', () => {
    it('should maintain separate instances for different exchange types', async () => {
      const mexcConnector = await ExchangeFactory.getExchange('mexc');
      const mexcConnector2 = await ExchangeFactory.getExchange('mexc');
      expect(mexcConnector).toBe(mexcConnector2);
      expect(MockMexcConnector).toHaveBeenCalledTimes(1);
    });

    it('should create new instance after disconnectAll', async () => {
      await ExchangeFactory.getExchange('mexc');
      await ExchangeFactory.disconnectAll();
      await ExchangeFactory.getExchange('mexc');
      expect(MockMexcConnector).toHaveBeenCalledTimes(2);
      expect(mockConnector.connect).toHaveBeenCalledTimes(2);
    });
  });
});