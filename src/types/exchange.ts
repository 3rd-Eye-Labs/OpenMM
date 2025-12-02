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
  timestamp: number;
}

/**
 * WebSocket event types supported by exchanges
 */
export type WebSocketEventType = 'ticker' | 'orderbook' | 'trade' | 'order' | 'balance';

/**
 * WebSocket event data union type
 */
export type WebSocketEventData = Ticker | OrderBook | Trade | Order | Record<string, unknown>;

/**
 * WebSocket event structure for real-time updates
 */
export interface WebSocketEvent {
  type: WebSocketEventType;
  symbol?: string;
  data: WebSocketEventData;
  timestamp: number;
}

/**
 * WebSocket subscription configuration
 */
export interface SubscriptionOptions {
  symbol?: string;
  callback: (event: WebSocketEvent) => void;
  errorCallback?: (error: Error) => void;
}

/**
 * WebSocket connection status
 */
export type WebSocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
