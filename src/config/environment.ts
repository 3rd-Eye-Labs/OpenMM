import dotenv from 'dotenv';
import { createLogger } from '../utils';

dotenv.config();

const logger = createLogger('environment-validator');

interface EnvironmentConfig {
  mexc: {
    apiKey: string;
    secret: string;
    uid?: string;
  };

  // Future exchanges
  gateio?: {
    apiKey: string;
    secret: string;
  };

  bitget?: {
    apiKey: string;
    secret: string;
    passphrase: string;
  };

  kraken?: {
    apiKey: string;
    secret: string;
  };

  logLevel: string;
  nodeEnv: string;
}

class EnvironmentValidator {
  private static validateRequired(key: string, value: string | undefined): string {
    if (!value || value.trim() === '') {
      throw new Error(`Required environment variable ${key} is missing or empty`);
    }
    return value.trim();
  }

  private static validateOptional(value: string | undefined): string | undefined {
    return value && value.trim() !== '' ? value.trim() : undefined;
  }

  static validate(): EnvironmentConfig {
    try {
      const config: EnvironmentConfig = {
        mexc: {
          apiKey: this.validateRequired('MEXC_API_KEY', process.env.MEXC_API_KEY),
          secret: this.validateRequired('MEXC_SECRET', process.env.MEXC_SECRET),
          uid: this.validateOptional(process.env.MEXC_UID),
        },

        logLevel: process.env.LOG_LEVEL || 'info',
        nodeEnv: process.env.NODE_ENV || 'development',
      };

      if (process.env.GATEIO_API_KEY && process.env.GATEIO_SECRET) {
        config.gateio = {
          apiKey: process.env.GATEIO_API_KEY,
          secret: process.env.GATEIO_SECRET,
        };
      }

      if (
        process.env.BITGET_API_KEY &&
        process.env.BITGET_SECRET &&
        process.env.BITGET_PASSPHRASE
      ) {
        config.bitget = {
          apiKey: process.env.BITGET_API_KEY,
          secret: process.env.BITGET_SECRET,
          passphrase: process.env.BITGET_PASSPHRASE,
        };
      }

      if (process.env.KRAKEN_API_KEY && process.env.KRAKEN_SECRET) {
        config.kraken = {
          apiKey: process.env.KRAKEN_API_KEY,
          secret: process.env.KRAKEN_SECRET,
        };
      }

      const validLogLevels = ['error', 'warn', 'info', 'debug'];
      if (!validLogLevels.includes(config.logLevel)) {
        const errorMessage = `Invalid LOG_LEVEL: ${config.logLevel}. Must be one of: ${validLogLevels.join(', ')}`;
        logger.error('Environment validation failed', { error: errorMessage });
        logger.error('Please check your .env file and ensure all required variables are set');
        logger.error('See .env.example for reference');
        process.exit(1);
      }

      return config;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Environment validation failed', { error: errorMessage });
      logger.error('Please check your .env file and ensure all required variables are set');
      logger.error('See .env.example for reference');
      process.exit(1);
    }
  }
}

export const config = EnvironmentValidator.validate();
export default config;
