import dotenv from 'dotenv';
import path from 'path';
import { createLogger } from '../utils';

// Load .env from SDK directory for CLI usage.
// override: false ensures MCP env vars (passed by client) take priority.
const envPath = path.join(__dirname, '..', '..', '.env');
dotenv.config({ path: envPath, override: false });

const logger = createLogger('environment-validator');

interface EnvironmentConfig {
  mexc: {
    apiKey: string;
    secret: string;
    uid?: string;
  };

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
  private static validateOptional(value: string | undefined): string | undefined {
    return value && value.trim() !== '' ? value.trim() : undefined;
  }

  /**
   * Validate environment configuration.
   * 
   * IMPORTANT: This method throws errors instead of calling process.exit()
   * to allow callers (like MCP servers) to handle errors gracefully.
   * 
   * All exchange credentials are now optional - validation happens at
   * runtime when a specific exchange is used.
   */
  static validate(): EnvironmentConfig {
    const config: EnvironmentConfig = {
      // MEXC is now optional like other exchanges
      mexc: process.env.MEXC_API_KEY && process.env.MEXC_SECRET
        ? {
            apiKey: process.env.MEXC_API_KEY.trim(),
            secret: process.env.MEXC_SECRET.trim(),
            uid: this.validateOptional(process.env.MEXC_UID),
          }
        : { apiKey: '', secret: '' }, // Empty config - will fail at runtime if used

      logLevel: process.env.LOG_LEVEL || 'info',
      nodeEnv: process.env.NODE_ENV || 'development',
    };

    if (process.env.GATEIO_API_KEY && process.env.GATEIO_SECRET) {
      config.gateio = {
        apiKey: process.env.GATEIO_API_KEY.trim(),
        secret: process.env.GATEIO_SECRET.trim(),
      };
    }

    if (
      process.env.BITGET_API_KEY &&
      process.env.BITGET_SECRET &&
      process.env.BITGET_PASSPHRASE
    ) {
      config.bitget = {
        apiKey: process.env.BITGET_API_KEY.trim(),
        secret: process.env.BITGET_SECRET.trim(),
        passphrase: process.env.BITGET_PASSPHRASE.trim(),
      };
    }

    if (process.env.KRAKEN_API_KEY && process.env.KRAKEN_SECRET) {
      config.kraken = {
        apiKey: process.env.KRAKEN_API_KEY.trim(),
        secret: process.env.KRAKEN_SECRET.trim(),
      };
    }

    const validLogLevels = ['error', 'warn', 'info', 'debug'];
    if (!validLogLevels.includes(config.logLevel)) {
      // Throw instead of process.exit - let caller handle it
      throw new Error(
        `Invalid LOG_LEVEL: ${config.logLevel}. Must be one of: ${validLogLevels.join(', ')}`
      );
    }

    return config;
  }

  /**
   * Validate that a specific exchange is configured.
   * Call this at runtime when an exchange is actually used.
   */
  static validateExchange(exchange: 'mexc' | 'gateio' | 'bitget' | 'kraken'): void {
    const cfg = config[exchange];
    if (!cfg || !cfg.apiKey || !cfg.secret) {
      throw new Error(
        `Exchange ${exchange.toUpperCase()} is not configured. ` +
        `Please set ${exchange.toUpperCase()}_API_KEY and ${exchange.toUpperCase()}_SECRET environment variables.`
      );
    }
    if (exchange === 'bitget') {
      const bitgetCfg = config.bitget;
      if (!bitgetCfg?.passphrase) {
        throw new Error(
          `Bitget requires BITGET_PASSPHRASE environment variable.`
        );
      }
    }
  }
}

// Lazy validation - validates at import but doesn't call process.exit()
// Errors are thrown and can be caught by the caller
let _config: EnvironmentConfig | null = null;

/**
 * Clear cached config - call this if env vars change after initial load.
 */
export function resetConfig(): void {
  _config = null;
}

export const config: EnvironmentConfig = new Proxy({} as EnvironmentConfig, {
  get(_, prop: string) {
    // Always re-validate to pick up env var changes
    // This is slightly less efficient but ensures env vars are always fresh
    try {
      _config = EnvironmentValidator.validate();
    } catch (error) {
      // Log the error but don't exit - let the caller handle it
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn('Environment validation warning', { error: errorMessage });
      logger.warn('Some exchanges may not be available. Set credentials to enable them.');
      // Return a minimal config so the module can still load
      _config = {
        mexc: { apiKey: '', secret: '' },
        logLevel: 'info',
        nodeEnv: process.env.NODE_ENV || 'development',
      };
    }
    return (_config as any)[prop];
  },
});

// Export the validator for runtime exchange validation
export { EnvironmentValidator };
export default config;
