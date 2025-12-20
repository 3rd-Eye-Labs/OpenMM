import { Logger, createLogger, logger, LogLevel, LogContext } from '../../../utils';
import * as winston from 'winston';
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  })),
  format: {
    combine: jest.fn((...formats) => formats),
    timestamp: jest.fn(() => 'timestamp-format'),
    colorize: jest.fn(() => 'colorize-format'),
    printf: jest.fn(callback => callback),
    json: jest.fn(() => 'json-format'),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));
describe('Logger', () => {
  let mockWinstonLogger: any;
  beforeEach(() => {
    mockWinstonLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    (winston.createLogger as jest.Mock).mockReturnValue(mockWinstonLogger);
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  describe('Logger class', () => {
    it('should create logger with console transport only when no logFile provided', () => {
      new Logger('test-service');
      expect(winston.createLogger).toHaveBeenCalledWith({
        level: 'debug',
        defaultMeta: { service: 'test-service' },
        transports: expect.arrayContaining([expect.any(winston.transports.Console)]),
        exitOnError: false,
      });
    });
    it('should create logger with console and file transports when logFile provided', () => {
      new Logger('test-service', 'test.log');
      expect(winston.createLogger).toHaveBeenCalledWith({
        level: 'debug',
        defaultMeta: { service: 'test-service' },
        transports: expect.arrayContaining([
          expect.any(winston.transports.Console),
          expect.any(winston.transports.File),
          expect.any(winston.transports.File),
        ]),
        exitOnError: false,
      });
    });
    it('should create file transport with correct filename', () => {
      new Logger('test-service', 'test.log');
      expect(winston.transports.File).toHaveBeenCalledWith({
        filename: 'test.log',
        format: expect.any(Array),
      });
    });
    it('should create error file transport with correct filename', () => {
      new Logger('test-service', 'test.log');
      expect(winston.transports.File).toHaveBeenCalledWith({
        filename: 'test-error.log',
        level: 'error',
        format: expect.any(Array),
      });
    });
    it('should handle complex filename for error file', () => {
      new Logger('test-service', 'path/to/application.log');
      expect(winston.transports.File).toHaveBeenCalledWith({
        filename: 'path/to/application-error.log',
        level: 'error',
        format: expect.any(Array),
      });
    });
    describe('logging methods', () => {
      let logger: Logger;
      beforeEach(() => {
        logger = new Logger('test-service');
      });
      it('should log error messages', () => {
        const context: LogContext = { userId: 123, action: 'login' };
        logger.error('Test error message', context);
        expect(mockWinstonLogger.error).toHaveBeenCalledWith('Test error message', context);
      });
      it('should log warn messages', () => {
        const context: LogContext = { component: 'auth' };
        logger.warn('Test warning message', context);
        expect(mockWinstonLogger.warn).toHaveBeenCalledWith('Test warning message', context);
      });
      it('should log info messages', () => {
        const context: LogContext = { event: 'user_signup' };
        logger.info('Test info message', context);
        expect(mockWinstonLogger.info).toHaveBeenCalledWith('Test info message', context);
      });
      it('should log debug messages', () => {
        const context: LogContext = { debug: true };
        logger.debug('Test debug message', context);
        expect(mockWinstonLogger.debug).toHaveBeenCalledWith('Test debug message', context);
      });
      it('should log messages without context', () => {
        logger.error('Error without context');
        logger.warn('Warning without context');
        logger.info('Info without context');
        logger.debug('Debug without context');
        expect(mockWinstonLogger.error).toHaveBeenCalledWith('Error without context', undefined);
        expect(mockWinstonLogger.warn).toHaveBeenCalledWith('Warning without context', undefined);
        expect(mockWinstonLogger.info).toHaveBeenCalledWith('Info without context', undefined);
        expect(mockWinstonLogger.debug).toHaveBeenCalledWith('Debug without context', undefined);
      });
      describe('logError method', () => {
        it('should log error objects with stack trace', () => {
          const error = new Error('Test error');
          error.stack = 'Error stack trace';
          const context: LogContext = { userId: 456 };
          logger.logError(error, context);
          expect(mockWinstonLogger.error).toHaveBeenCalledWith('Error occurred', {
            userId: 456,
            error: {
              name: 'Error',
              message: 'Test error',
              stack: 'Error stack trace',
            },
          });
        });
        it('should log error objects without context', () => {
          const error = new Error('Test error without context');
          logger.logError(error);
          expect(mockWinstonLogger.error).toHaveBeenCalledWith('Error occurred', {
            error: {
              name: 'Error',
              message: 'Test error without context',
              stack: error.stack,
            },
          });
        });
        it('should handle custom error types', () => {
          class CustomError extends Error {
            constructor(message: string) {
              super(message);
              this.name = 'CustomError';
            }
          }
          const error = new CustomError('Custom error message');
          logger.logError(error);
          expect(mockWinstonLogger.error).toHaveBeenCalledWith('Error occurred', {
            error: {
              name: 'CustomError',
              message: 'Custom error message',
              stack: error.stack,
            },
          });
        });
      });
    });
  });
  describe('createLogger function', () => {
    it('should create a Logger instance', () => {
      const result = createLogger('test-service');
      expect(result).toBeInstanceOf(Logger);
    });
    it('should create a Logger instance with log file', () => {
      const result = createLogger('test-service', 'app.log');
      expect(result).toBeInstanceOf(Logger);
    });
    it('should pass correct parameters to Logger constructor', () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'constructor' as any).mockImplementation();
      createLogger('my-service', 'my-app.log');
      expect(winston.createLogger).toHaveBeenCalled();
      loggerSpy.mockRestore();
    });
  });
  describe('default logger', () => {
    it('should be a Logger instance', () => {
      expect(logger).toBeInstanceOf(Logger);
    });
    it('should be created with "openmm" service name', () => {
      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
    });
  });
  describe('LogLevel type', () => {
    it('should accept valid log level values', () => {
      const levels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
      levels.forEach(level => {
        expect(typeof level).toBe('string');
        expect(['error', 'warn', 'info', 'debug']).toContain(level);
      });
    });
  });
  describe('LogContext interface', () => {
    it('should allow any key-value pairs', () => {
      const context: LogContext = {
        userId: 123,
        sessionId: 'abc123',
        component: 'auth',
        nested: {
          prop: 'value',
        },
        array: [1, 2, 3],
        boolean: true,
        nullable: null,
        undefined: undefined,
      };
      expect(typeof context).toBe('object');
      expect(context.userId).toBe(123);
      expect(context.sessionId).toBe('abc123');
      expect(context.nested.prop).toBe('value');
    });
    it('should allow empty context', () => {
      const context: LogContext = {};
      expect(Object.keys(context)).toHaveLength(0);
    });
  });
});
