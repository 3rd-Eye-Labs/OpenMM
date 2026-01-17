/**
 * Kraken raw API response types
 *
 * This file contains type definitions for raw API responses from Kraken exchange.
 * These types represent the exact structure returned by Kraken's API endpoints
 * before being mapped to OpenMM's standardized format.
 */

/**
 * Raw ticker data as received from Kraken WebSocket
 */
export interface KrakenRawTickerData {
  symbol: string;
  bid: string;
  ask: string;
  last: string;
  volume: string;
  volume_quote?: string;
  timestamp?: number;
  [key: string]: unknown;
}

/**
 * Raw order book data as received from Kraken WebSocket  
 */
export interface KrakenRawOrderBookData {
  symbol: string;
  bids: Array<[string, string, string]>;
  asks: Array<[string, string, string]>;
  [key: string]: unknown;
}

/**
 * Raw trade data as received from Kraken WebSocket
 */
export interface KrakenRawTradeData {
  symbol: string;
  price: string;
  qty: string;
  volume?: string;
  side: 'buy' | 'sell';
  time: string;
  trade_id?: string;
  ord_id?: string;
  timestamp?: number;
  [key: string]: unknown;
}

/**
 * Raw order data as received from Kraken WebSocket
 */
export interface KrakenRawOrderData {
  orderId?: string;
  order_id?: string;
  ord_id?: string;
  symbol: string;
  side: 'buy' | 'sell';
  orderType?: 'market' | 'limit';
  order_type?: 'market' | 'limit';
  qty?: string;
  order_qty?: string;
  price?: string;
  limit_price?: string;
  filled_qty?: string;
  exec_qty?: string;
  leaves_qty?: string;
  status: string;
  timestamp?: number;
  [key: string]: unknown;
}

/**
 * Raw balance data as received from Kraken REST API
 */
export interface KrakenRawBalance {
  [asset: string]: string;
}

/**
 * Kraken WebSocket message structure
 */
export interface KrakenWebSocketMessage {
  channel?: string;
  type?: 'subscribe' | 'unsubscribe' | 'update' | 'snapshot' | 'error';
  data?: (KrakenRawTickerData | KrakenRawOrderBookData | KrakenRawTradeData | KrakenRawOrderData)[];
  symbol?: string;
  req_id?: number;
  success?: boolean;
  error?: string;
  subscription?: {
    name: string;
    token?: string;
  };
}