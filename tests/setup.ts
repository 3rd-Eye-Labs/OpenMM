// Jest setup file for global test configuration

jest.setTimeout(60000);

// Mock environment variables for API tests
process.env.MEXC_API_KEY = 'test-key';
process.env.MEXC_SECRET_KEY = 'test-secret';
process.env.GATEIO_API_KEY = 'test-key';
process.env.GATEIO_SECRET_KEY = 'test-secret';
process.env.BITGET_API_KEY = 'test-key';
process.env.BITGET_SECRET_KEY = 'test-secret';
process.env.BITGET_PASSPHRASE = 'test-passphrase';
process.env.KRAKEN_API_KEY = 'test-key';
process.env.KRAKEN_SECRET_KEY = 'test-secret';

process.on('unhandledRejection', (reason, promise) => {
  console.warn('Unhandled Rejection at:', promise, 'reason:', reason);
});