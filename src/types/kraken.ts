import { Order, OrderBook, Ticker, Trade, Balance } from './index';

/**
 * Subscription callback information for different data types
 */
export type KrakenSubscriptionInfo =
  | {
      callback: (data: Ticker) => void;
      type: 'ticker';
      symbol: string;
      id: string;
      reqId?: number;
    }
  | {
      callback: (data: OrderBook) => void;
      type: 'orderbook';
      symbol: string;
      id: string;
      reqId?: number;
    }
  | {
      callback: (data: Trade) => void;
      type: 'trades';
      symbol: string;
      id: string;
      reqId?: number;
    }
  | {
      callback: (data: Order) => void;
      type: 'orders';
      symbol?: string;
      id: string;
      reqId?: number;
      resolve?: () => void;
      reject?: (error: Error) => void;
    }
  | {
      callback: (data: Trade) => void;
      type: 'user_trades';
      symbol?: string;
      id: string;
      reqId?: number;
    }
  | {
      callback: (data: Record<string, Balance>) => void;
      type: 'balances';
      symbol?: string;
      id: string;
      reqId?: number;
    };
