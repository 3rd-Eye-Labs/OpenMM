/**
 * Bitget raw API response types
 *
 * This file contains type definitions for raw API responses from Bitget exchange.
 * These types represent the exact structure returned by Bitget's API endpoints
 * before being mapped to OpenMM's standardized format.
 */

/**
 * Bitget raw order format from API response
 * Supports both REST API and WebSocket formats
 */
export interface BitgetRawOrder {
  orderId: string;
  clientOid?: string;
  // Symbol fields (REST uses 'symbol', WebSocket uses 'instId')
  symbol?: string;
  instId?: string;
  side: string;
  orderType: string;
  force?: string;
  price?: string;
  size: string;
  // Filled quantity fields (REST uses 'filledQty', WebSocket uses 'accBaseVolume')
  filledQty?: string;
  accBaseVolume?: string;
  // Status fields (REST uses 'state', WebSocket uses 'status')
  state?: string;
  status?: string;
  // Timestamp fields (can be number or string)
  cTime?: number | string;
  uTime?: number | string;
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
