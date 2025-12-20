/**
 * Bitget Exchange Specific Types
 *
 * Type definitions for Bitget exchange-specific data structures and WebSocket messages
 */

import { Order, OrderBook, Ticker, Trade } from './index';

/**
 * Subscription callback information for different data types
 */
export type BitgetSubscriptionInfo =
  | {
      callback: (data: Ticker) => void;
      type: 'ticker';
      symbol: string;
    }
  | {
      callback: (data: OrderBook) => void;
      type: 'orderbook';
      symbol: string;
    }
  | {
      callback: (data: Trade) => void;
      type: 'trades';
      symbol: string;
    }
  | {
      callback: (data: Order) => void;
      type: 'orders';
      symbol?: string;
    }
  | {
      callback: (data: Trade) => void;
      type: 'user_trades';
      symbol?: string;
    }
  | {
      callback: (data: any) => void;
      type: 'account';
      symbol?: string;
    };
