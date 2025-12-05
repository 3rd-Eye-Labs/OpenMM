/**
 * Basic price information
 */
export interface Price {
  value: number;
  timestamp: number;
}

/**
 * Market data structure
 */
export interface MarketData {
  symbol: string;
  price: number;
  timestamp: number;
}