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
