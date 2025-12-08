/**
 * Basic order types and enums for trading operations
 */
export type OrderType = 'market' | 'limit';
export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'open' | 'filled' | 'cancelled' | 'rejected';

/**
 * Order structure for basic trading operations
 */
export interface Order {
  id: string;
  symbol: string;
  type: OrderType;
  side: OrderSide;
  amount: number;
  price?: number;
  filled: number;
  remaining: number;
  status: OrderStatus;
  timestamp: number;
}

/**
 * Basic trade information
 */
export interface Trade {
  id: string;
  symbol: string;
  side: OrderSide;
  amount: number;
  price: number;
  timestamp: number;
  orderId?: string;
  fee?: number;
}

/**
 * Order book entry for market data
 */
export interface OrderBookEntry {
  price: number;
  amount: number;
}

/**
 * Order book structure
 */
export interface OrderBook {
  symbol: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  timestamp: number;
}

/**
 * Basic ticker information
 */
export interface Ticker {
  symbol: string;
  last: number;
  bid: number;
  ask: number;
  baseVolume: number;
  quoteVolume?: number;
  timestamp: number;
}

/**
 * WebSocket connection status
 */
export type WebSocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
