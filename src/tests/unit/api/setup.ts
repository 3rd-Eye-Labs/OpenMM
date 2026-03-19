// Mock environment to prevent process.exit during tests
process.env.MEXC_API_KEY = 'test-key';
process.env.MEXC_SECRET = 'test-secret';

// Prevent actual process.exit
const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
  throw new Error(`process.exit called with "${code}"`);
});

export { mockExit };
