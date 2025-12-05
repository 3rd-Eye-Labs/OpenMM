import * as winston from 'winston';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogContext {
  [key: string]: any;
}

/**
 * Minimal Winston-based logger
 * Supports console + optional file logging
 */
export class Logger {
  private winston: winston.Logger;

  constructor(service: string, logFile?: string) {
    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp({ format: 'HH:mm:ss' }),
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} [${service}] ${level}: ${message}${metaStr}`;
          })
        )
      })
    ];

    if (logFile) {
      const fileFormat = winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      );

      transports.push(
        new winston.transports.File({ 
          filename: logFile, 
          format: fileFormat 
        }),
        new winston.transports.File({ 
          filename: logFile.replace('.log', '-error.log'), 
          level: 'error',
          format: fileFormat 
        })
      );
    }

    this.winston = winston.createLogger({
      level: 'debug',
      defaultMeta: { service },
      transports,
      exitOnError: false
    });
  }

  error(message: string, context?: LogContext): void {
    this.winston.error(message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.winston.warn(message, context);
  }

  info(message: string, context?: LogContext): void {
    this.winston.info(message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.winston.debug(message, context);
  }

  /**
   * Log error objects with stack traces
   */
  logError(error: Error, context?: LogContext): void {
    this.winston.error('Error occurred', {
      ...context,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    });
  }
}

/**
 * Create a new logger instance
 */
export function createLogger(service: string, logFile?: string): Logger {
  return new Logger(service, logFile);
}

/**
 * Default logger instance
 */
export const logger = createLogger('openmm');