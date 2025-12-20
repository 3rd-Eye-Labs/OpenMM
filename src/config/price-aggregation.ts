/**
 * Price Aggregation Configuration
 * All endpoints and settings for price services
 */

import { CardanoTokenConfig } from '../types';

export const CEX_API_CONFIG = {
  BINANCE: {
    BASE_URL: 'https://api.binance.com/api/v3',
    ENDPOINTS: {
      TICKER_PRICE: '/ticker/price',
    },
  },
  MEXC: {
    BASE_URL: 'https://api.mexc.com/api/v3',
    ENDPOINTS: {
      TICKER_PRICE: '/ticker/price',
    },
  },
  COINGECKO: {
    BASE_URL: 'https://api.coingecko.com/api/v3',
    ENDPOINTS: {
      SIMPLE_PRICE: '/simple/price',
    },
  },
  KRAKEN: {
    BASE_URL: 'https://api.kraken.com/0/public',
    ENDPOINTS: {
      TICKER: '/Ticker',
    },
  },
};

export const IRIS_CONFIG = {
  BASE_URL: 'https://iris.indigoprotocol.io',
  TIMEOUT: 10000,
};

export const SUPPORTED_TOKENS: Record<string, CardanoTokenConfig> = {
  INDY: {
    symbol: 'INDY',
    policyId: '533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0',
    assetName: '494e4459',
    minLiquidityThreshold: 100000,
  },
  SNEK: {
    symbol: 'SNEK',
    policyId: '279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f',
    assetName: '534e454b',
    minLiquidityThreshold: 50000,
  },
  NIGHT: {
    symbol: 'NIGHT',
    policyId: '0691b2fecca1ac4f53cb6dfb00b7013e561d1f34403b957cbb5af1fa',
    assetName: '4e49474854',
    minLiquidityThreshold: 25000,
  },
  MIN: {
    symbol: 'MIN',
    policyId: '29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c6',
    assetName: '4d494e',
    minLiquidityThreshold: 100000,
  },
};

/**
 * Get token configuration by symbol
 */
export function getTokenConfig(symbol: string): CardanoTokenConfig {
  const config = SUPPORTED_TOKENS[symbol.toUpperCase()];
  if (!config) {
    throw new Error(`Unsupported token: ${symbol}`);
  }
  return config;
}

/**
 * Check if token is supported
 */
export function isTokenSupported(symbol: string): boolean {
  return symbol.toUpperCase() in SUPPORTED_TOKENS;
}

/**
 * Get all supported token symbols
 */
export function getSupportedTokens(): string[] {
  return Object.keys(SUPPORTED_TOKENS);
}
