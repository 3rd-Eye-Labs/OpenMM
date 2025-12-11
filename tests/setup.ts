// Jest setup file for global test configuration

jest.setTimeout(60000);

process.on('unhandledRejection', (reason, promise) => {
  console.warn('Unhandled Rejection at:', promise, 'reason:', reason);
});