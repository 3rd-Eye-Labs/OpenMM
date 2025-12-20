jest.mock('../../../utils', () => ({
  createLogger: jest.fn(() => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  })),
}));
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

describe('Environment Configuration', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let mockProcessExit: jest.SpyInstance;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv };
    delete process.env.MEXC_UID;
    delete process.env.NODE_ENV;
    delete process.env.LOG_LEVEL;
    delete process.env.MEXC_API_KEY;
    delete process.env.MEXC_SECRET;
    delete process.env.GATEIO_API_KEY;
    delete process.env.GATEIO_SECRET;
    delete process.env.BITGET_API_KEY;
    delete process.env.BITGET_SECRET;
    delete process.env.BITGET_PASSPHRASE;
    delete process.env.KRAKEN_API_KEY;
    delete process.env.KRAKEN_SECRET;
    mockProcessExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    mockProcessExit.mockRestore();
    jest.resetModules();
  });

  describe('Environment validation', () => {
    it('should validate and return config with required MEXC credentials', async () => {
      delete process.env.MEXC_UID;
      process.env.MEXC_API_KEY = 'test-api-key';
      process.env.MEXC_SECRET = 'test-secret';
      const { config } = await import('../../../config/environment');
      expect(config.mexc.apiKey).toBe('test-api-key');
      expect(config.mexc.secret).toBe('test-secret');
      expect(config.mexc.uid).toBeUndefined();
    });

    it('should include optional MEXC UID when provided', async () => {
      process.env.MEXC_API_KEY = 'test-api-key';
      process.env.MEXC_SECRET = 'test-secret';
      process.env.MEXC_UID = 'test-uid';
      const { config } = await import('../../../config/environment');
      expect(config.mexc.uid).toBe('test-uid');
    });

    it('should use default values for optional settings', async () => {
      process.env.MEXC_API_KEY = 'test-api-key';
      process.env.MEXC_SECRET = 'test-secret';
      const { config } = await import('../../../config/environment');
      expect(config.logLevel).toBe('info');
      expect(config.nodeEnv).toBe('development');
    });

    it('should use environment values when provided', async () => {
      process.env.MEXC_API_KEY = 'test-api-key';
      process.env.MEXC_SECRET = 'test-secret';
      process.env.LOG_LEVEL = 'debug';
      process.env.NODE_ENV = 'production';
      const { config } = await import('../../../config/environment');
      expect(config.logLevel).toBe('debug');
      expect(config.nodeEnv).toBe('production');
    });

    it('should include GateIO config when credentials are provided', async () => {
      process.env.MEXC_API_KEY = 'test-api-key';
      process.env.MEXC_SECRET = 'test-secret';
      process.env.GATEIO_API_KEY = 'gateio-key';
      process.env.GATEIO_SECRET = 'gateio-secret';
      const { config } = await import('../../../config/environment');
      expect(config.gateio).toEqual({
        apiKey: 'gateio-key',
        secret: 'gateio-secret',
      });
    });

    it('should include Bitget config when all credentials are provided', async () => {
      process.env.MEXC_API_KEY = 'test-api-key';
      process.env.MEXC_SECRET = 'test-secret';
      process.env.BITGET_API_KEY = 'bitget-key';
      process.env.BITGET_SECRET = 'bitget-secret';
      process.env.BITGET_PASSPHRASE = 'bitget-passphrase';
      const { config } = await import('../../../config/environment');
      expect(config.bitget).toEqual({
        apiKey: 'bitget-key',
        secret: 'bitget-secret',
        passphrase: 'bitget-passphrase',
      });
    });

    it('should include Kraken config when credentials are provided', async () => {
      process.env.MEXC_API_KEY = 'test-api-key';
      process.env.MEXC_SECRET = 'test-secret';
      process.env.KRAKEN_API_KEY = 'kraken-key';
      process.env.KRAKEN_SECRET = 'kraken-secret';
      const { config } = await import('../../../config/environment');
      expect(config.kraken).toEqual({
        apiKey: 'kraken-key',
        secret: 'kraken-secret',
      });
    });

    it('should not include partial Bitget config', async () => {
      process.env.MEXC_API_KEY = 'test-api-key';
      process.env.MEXC_SECRET = 'test-secret';
      process.env.BITGET_API_KEY = 'bitget-key';
      process.env.BITGET_SECRET = 'bitget-secret';
      const { config } = await import('../../../config/environment');
      expect(config.bitget).toBeUndefined();
    });

    it('should accept all valid log levels', async () => {
      const validLevels = ['error', 'warn', 'info', 'debug'];
      for (const level of validLevels) {
        jest.resetModules();
        delete process.env.LOG_LEVEL;
        process.env.MEXC_API_KEY = 'test-api-key';
        process.env.MEXC_SECRET = 'test-secret';
        process.env.LOG_LEVEL = level;
        const { config } = await import('../../../config/environment');
        expect(config.logLevel).toBe(level);
      }
    });

    it('should handle trimmed values correctly', async () => {
      process.env.MEXC_API_KEY = '  test-api-key  ';
      process.env.MEXC_SECRET = '  test-secret  ';
      process.env.MEXC_UID = '  test-uid  ';
      const { config } = await import('../../../config/environment');
      expect(config.mexc.apiKey).toBe('test-api-key');
      expect(config.mexc.secret).toBe('test-secret');
      expect(config.mexc.uid).toBe('test-uid');
    });

    it('should handle empty optional values correctly', async () => {
      process.env.MEXC_API_KEY = 'test-api-key';
      process.env.MEXC_SECRET = 'test-secret';
      process.env.MEXC_UID = '';
      const { config } = await import('../../../config/environment');
      expect(config.mexc.uid).toBeUndefined();
    });

    it('should contain the expected configuration structure', async () => {
      process.env.MEXC_API_KEY = 'test-api-key';
      process.env.MEXC_SECRET = 'test-secret';
      const { config } = await import('../../../config/environment');
      expect(config).toHaveProperty('mexc');
      expect(config).toHaveProperty('logLevel');
      expect(config).toHaveProperty('nodeEnv');
      expect(config.mexc).toHaveProperty('apiKey');
      expect(config.mexc).toHaveProperty('secret');
    });
  });
});
