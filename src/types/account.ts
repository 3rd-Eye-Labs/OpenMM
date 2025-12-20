/**
 * Exchange API credentials for account authentication
 * Supports different exchange authentication patterns
 */
export interface ExchangeCredentials {
  apiKey: string;
  secret: string;
  uid?: string;
  passphrase?: string;
}

/**
 * Simple balance representation
 */
export interface Balance {
  asset: string;
  free: number;
  used: number;
  total: number;
  available: number;
}
