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

/**
 * OHLCV candlestick data
 */
export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Supported OHLCV timeframes
 */
export type OHLCVTimeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';
