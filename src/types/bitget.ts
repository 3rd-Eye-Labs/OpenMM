/**
 * Bitget Exchange Specific Types
 * 
 * Type definitions for Bitget exchange-specific data structures and WebSocket messages
 */

import { Order, OrderBook, Ticker, Trade } from './index';

/**
 * Bitget subscription types for WebSocket connections
 */
export interface BitgetSubscription {
  op: 'subscribe' | 'unsubscribe';
  args: string[];
}

/**
 * Bitget WebSocket message structure
 */
export interface BitgetWebSocketMessage {
  action?: string;
  arg?: {
    channel: string;
    instId: string;
  };
  data?: any[];
  code?: string;
  msg?: string;
  event?: string;
}

/**
 * Subscription callback information for different data types
 */
export type BitgetSubscriptionInfo = 
  | {
      callback: (data: Ticker) => void;
      type: 'ticker';
    }
  | {
      callback: (data: OrderBook) => void;
      type: 'orderbook';
    }
  | {
      callback: (data: Trade) => void;
      type: 'trades';
    }
  | {
      callback: (data: Order) => void;
      type: 'orders';
    };

/**
 * Bitget API error response structure
 */
export interface BitgetApiError {
  code: string;
  msg: string;
  requestTime: number;
  data?: any;
}

/**
 * Bitget API success response structure
 */
export interface BitgetApiResponse<T = any> {
  code: string;
  msg: string;
  requestTime: number;
  data: T;
}