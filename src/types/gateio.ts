/**
 * Gate.io Exchange Specific Types
 *
 * Type definitions for Gate.io exchange-specific data structures and WebSocket messages
 */

import { Order, OrderBook, Ticker, Trade, Balance } from './index';

/**
 * Subscription callback information for different data types
 */
export type GateioSubscriptionInfo =
  | {
      callback: (data: Ticker) => void;
      type: 'ticker';
      symbol: string;
      channel: string;
    }
  | {
      callback: (data: OrderBook) => void;
      type: 'orderbook';
      symbol: string;
      channel: string;
    }
  | {
      callback: (data: Trade) => void;
      type: 'trades';
      symbol: string;
      channel: string;
    }
  | {
      callback: (data: Order) => void;
      type: 'orders';
      symbol: string;
      channel: string;
    }
  | {
      callback: (data: Trade) => void;
      type: 'usertrades';
      symbol: string;
      channel: string;
    }
  | {
      callback: (data: Record<string, Balance>) => void;
      type: 'balances';
      symbol: string;
      channel: string;
    };
