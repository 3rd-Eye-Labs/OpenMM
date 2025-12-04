import dotenv from 'dotenv';

dotenv.config();

export interface EnvironmentConfig {
  nodeEnv: string;
  logLevel: string;
  mexc: {
    apiUrl: string;
    apiKey?: string;
    secret?: string;
    uid?: string;
  };
}

function getRequiredEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

function getOptionalEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] || defaultValue;
}

export const config: EnvironmentConfig = {
  nodeEnv: getRequiredEnv('NODE_ENV', 'development'),
  logLevel: getRequiredEnv('LOG_LEVEL', 'info'),
  mexc: {
    apiUrl: getRequiredEnv('MEXC_API_URL'),
    apiKey: getOptionalEnv('MEXC_API_KEY'),
    secret: getOptionalEnv('MEXC_SECRET'),
    uid: getOptionalEnv('MEXC_UID')
  }
};

export default config;