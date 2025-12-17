/**
 * Bitget raw API response types
 * 
 * This file contains type definitions for raw API responses from Bitget exchange.
 * These types represent the exact structure returned by Bitget's API endpoints
 * before being mapped to OpenMM's standardized format.
 */

/**
 * Bitget raw order format from API response
 */
export interface BitgetRawOrder {
  orderId: string;
  clientOid?: string;
  symbol: string;
  side: string;
  orderType: string;
  force?: string;
  price?: string;
  size: string;
  filledQty?: string;
  state?: string;
  status?: string;
  cTime?: number;
  uTime?: number;
}

/**
 * Bitget raw balance format
 */
export interface BitgetRawBalance {
  coin: string;
  available: string;
  frozen: string;
  locked?: string;
}

/**
 * Bitget raw account format
 */
export interface BitgetRawAccount {
  data: BitgetRawBalance[];
}

/**
 * Bitget raw ticker format
 */
export interface BitgetRawTicker {
  symbol: string;
  lastPr: string;
  bidPr: string;
  askPr: string;
  baseVolume: string;
  quoteVolume?: string;
  usdtVolume?: string;
  ts: string;
}

/**
 * Bitget raw orderbook format
 */
export interface BitgetRawOrderBook {
  bids: [string, string][];
  asks: [string, string][];
  ts: string;
}

/**
 * Bitget raw trade format
 */
export interface BitgetRawTrade {
  tradeId: string;
  price: string;
  size: string;
  side: string;
  ts: string;
}