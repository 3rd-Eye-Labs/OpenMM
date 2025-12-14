import { BaseStrategy } from '../../../../core/strategy/base-strategy';
import { Order, StrategyType, StrategyStatus, StrategyConfig } from '../../../../types';
class TestStrategy extends BaseStrategy {
  private initializeCallCount = 0;
  private startCallCount = 0;
  private stopCallCount = 0;
  private priceUpdateCallCount = 0;
  private orderUpdateCallCount = 0;
  constructor(id: string, type: StrategyType = 'grid') {
    super(id, type);
  }
  async initialize(config: StrategyConfig): Promise<void> {
    this.initializeCallCount++;
    this.validateConfig(config);
    this.config = config;
    this.setStatus('running');
  }
  async start(): Promise<void> {
    this.startCallCount++;
    this.setStatus('running');
  }
  async stop(): Promise<void> {
    this.stopCallCount++;
    this.setStatus('stopped');
  }
  async onPriceUpdate(symbol: string, price: number): Promise<void> {
    this.priceUpdateCallCount++;
  }
  async onOrderUpdate(order: Order): Promise<void> {
    this.orderUpdateCallCount++;
  }
  public testSetStatus(status: StrategyStatus): void {
    this.setStatus(status);
  }
  public testGetConfig(): StrategyConfig {
    return this.getConfig();
  }
  public testValidateConfig(config: StrategyConfig): void {
    this.validateConfig(config);
  }
  public testHandleError(error: any, operation: string): void {
    this.handleError(error, operation);
  }
  public get initializeCalls(): number { return this.initializeCallCount; }
  public get startCalls(): number { return this.startCallCount; }
  public get stopCalls(): number { return this.stopCallCount; }
  public get priceUpdateCalls(): number { return this.priceUpdateCallCount; }
  public get orderUpdateCalls(): number { return this.orderUpdateCallCount; }
}

describe('BaseStrategy', () => {
  let strategy: TestStrategy;
  const validConfig: StrategyConfig = {
    id: 'test-strategy-1',
    type: 'grid',
    symbol: 'BTC/USDT',
    exchange: 'mexc',
    accountId: 'main',
    enabled: true
  };
  beforeEach(() => {
    strategy = new TestStrategy('test-strategy-1', 'grid');
  });

  describe('constructor', () => {
    it('should initialize with correct id and type', () => {
      expect(strategy.id).toBe('test-strategy-1');
      expect(strategy.type).toBe('grid');
      expect(strategy.currentStatus).toBe('idle');
    });

    it('should default to idle status', () => {
      expect(strategy.currentStatus).toBe('idle');
    });
  });

  describe('getters', () => {
    it('should return correct strategy id', () => {
      const strategy = new TestStrategy('unique-id', 'grid');
      expect(strategy.id).toBe('unique-id');
    });

    it('should return correct strategy type', () => {
      const strategy = new TestStrategy('test-id', 'grid');
      expect(strategy.type).toBe('grid');
    });

    it('should return current status', () => {
      expect(strategy.currentStatus).toBe('idle');
      strategy.testSetStatus('running');
      expect(strategy.currentStatus).toBe('running');
    });
  });

  describe('abstract methods', () => {
    it('should call initialize method', async () => {
      await strategy.initialize(validConfig);
      expect(strategy.initializeCalls).toBe(1);
      expect(strategy.currentStatus).toBe('running');
    });

    it('should call start method', async () => {
      await strategy.start();
      expect(strategy.startCalls).toBe(1);
      expect(strategy.currentStatus).toBe('running');
    });

    it('should call stop method', async () => {
      await strategy.stop();
      expect(strategy.stopCalls).toBe(1);
      expect(strategy.currentStatus).toBe('stopped');
    });

    it('should call onPriceUpdate method', async () => {
      await strategy.onPriceUpdate('BTC/USDT', 50000);
      expect(strategy.priceUpdateCalls).toBe(1);
    });

    it('should call onOrderUpdate method', async () => {
      const order: Order = {
        id: 'order-1',
        symbol: 'BTC/USDT',
        side: 'buy',
        type: 'limit',
        amount: 0.1,
        price: 50000,
        filled: 0,
        remaining: 0.1,
        status: 'open',
        timestamp: Date.now()
      };
      await strategy.onOrderUpdate(order);
      expect(strategy.orderUpdateCalls).toBe(1);
    });
  });

  describe('protected setStatus method', () => {
    it('should update strategy status', () => {
      strategy.testSetStatus('running');
      expect(strategy.currentStatus).toBe('running');
      strategy.testSetStatus('running');
      expect(strategy.currentStatus).toBe('running');
      strategy.testSetStatus('stopped');
      expect(strategy.currentStatus).toBe('stopped');
      strategy.testSetStatus('error');
      expect(strategy.currentStatus).toBe('error');
    });

    it('should handle all valid status values', () => {
      const statuses: StrategyStatus[] = ['idle', 'running', 'stopped', 'error'];
      statuses.forEach(status => {
        strategy.testSetStatus(status);
        expect(strategy.currentStatus).toBe(status);
      });
    });
  });

  describe('protected getConfig method', () => {
    it('should return config after initialization', async () => {
      await strategy.initialize(validConfig);
      const retrievedConfig = strategy.testGetConfig();
      expect(retrievedConfig).toEqual(validConfig);
    });

    it('should throw error when config not set', () => {
      expect(() => strategy.testGetConfig()).toThrow('Strategy test-strategy-1 not initialized');
    });
  });

  describe('protected validateConfig method', () => {
    it('should validate valid configuration', () => {
      expect(() => strategy.testValidateConfig(validConfig)).not.toThrow();
    });

    it('should throw error for missing id', () => {
      const invalidConfig = { ...validConfig, id: '' };
      expect(() => strategy.testValidateConfig(invalidConfig))
        .toThrow('Invalid strategy configuration');
    });

    it('should throw error for missing type', () => {
      const invalidConfig = { ...validConfig, type: undefined as any };
      expect(() => strategy.testValidateConfig(invalidConfig))
        .toThrow('Invalid strategy configuration');
    });

    it('should throw error for missing symbol', () => {
      const invalidConfig = { ...validConfig, symbol: '' };
      expect(() => strategy.testValidateConfig(invalidConfig))
        .toThrow('Invalid strategy configuration');
    });

    it('should throw error for missing exchange', () => {
      const invalidConfig = { ...validConfig, exchange: '' };
      expect(() => strategy.testValidateConfig(invalidConfig))
        .toThrow('Invalid strategy configuration');
    });

    it('should throw error for completely missing properties', () => {
      const invalidConfig = {} as StrategyConfig;
      expect(() => strategy.testValidateConfig(invalidConfig))
        .toThrow('Invalid strategy configuration');
    });
  });

  describe('protected handleError method', () => {
    it('should handle error with message', () => {
      const error = new Error('Test error message');
      expect(() => strategy.testHandleError(error, 'testing'))
        .toThrow('Strategy test-strategy-1 testing failed: Test error message');
      expect(strategy.currentStatus).toBe('error');
    });

    it('should handle error without message', () => {
      const error = { toString: () => 'Error object string' };
      expect(() => strategy.testHandleError(error, 'processing'))
        .toThrow('Strategy test-strategy-1 processing failed: Error object string');
      expect(strategy.currentStatus).toBe('error');
    });

    it('should handle null or undefined errors', () => {
      expect(() => strategy.testHandleError(null, 'operation'))
        .toThrow('Strategy test-strategy-1 operation failed: Unknown error');
      strategy.testSetStatus('running'); 
      expect(() => strategy.testHandleError(undefined, 'operation'))
        .toThrow('Strategy test-strategy-1 operation failed: Unknown error');
    });

    it('should handle string errors', () => {
      expect(() => strategy.testHandleError('String error', 'operation'))
        .toThrow('Strategy test-strategy-1 operation failed: String error');
    });

    it('should handle number errors', () => {
      expect(() => strategy.testHandleError(404, 'operation'))
        .toThrow('Strategy test-strategy-1 operation failed: 404');
    });

    it('should always set status to error', () => {
      strategy.testSetStatus('running');
      expect(strategy.currentStatus).toBe('running');
      try {
        strategy.testHandleError(new Error('test'), 'operation');
      } catch (e) {
      }
      expect(strategy.currentStatus).toBe('error');
    });
  });

  describe('integration scenarios', () => {
    it('should follow typical lifecycle', async () => {
      expect(strategy.currentStatus).toBe('idle');
      await strategy.initialize(validConfig);
      expect(strategy.currentStatus).toBe('running');
      expect(strategy.testGetConfig()).toEqual(validConfig);
      await strategy.start();
      expect(strategy.currentStatus).toBe('running');
      await strategy.onPriceUpdate('BTC/USDT', 50000);
      expect(strategy.priceUpdateCalls).toBe(1);
      await strategy.stop();
      expect(strategy.currentStatus).toBe('stopped');
    });

    it('should handle errors during lifecycle', async () => {
      await strategy.initialize(validConfig);
      await strategy.start();
      expect(strategy.currentStatus).toBe('running');
      try {
        strategy.testHandleError(new Error('Simulated error'), 'price processing');
      } catch (e) {
      }
      expect(strategy.currentStatus).toBe('error');
    });

    it('should validate configuration before initialization', async () => {
      const invalidConfig = { ...validConfig, symbol: '' };
      await expect(strategy.initialize(invalidConfig)).rejects.toThrow('Invalid strategy configuration');
    });
  });
});