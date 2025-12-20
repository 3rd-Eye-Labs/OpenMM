/**
 * MEXC Exchange Specific Types
 *
 * Type definitions for MEXC protobuf messages and exchange-specific data structures
 */

import { Order, OrderBook, Ticker, Trade } from './index';

export interface DecodedMexcOrder {
  orderId: string;
  symbol: string;
  price: number;
  quantity: number;
  side: 'buy' | 'sell';
  status: string;
  timestamp: number;
  channel: string;
}

export interface DecodedMexcTickerData {
  bidprice: string;
  askprice: string;
  bidquantity: string;
  askquantity: string;
}

export interface DecodedMexcTradesData {
  dealsList: Array<{
    price: string;
    quantity: string;
    time: string;
    tradetype: number;
  }>;
  eventtype: string;
}

export interface DecodedMexcMessage {
  type: 'order' | 'ticker' | 'orderbook' | 'trades' | 'unknown';
  raw: string;
  channel: string;
  symbol?: string;
  decoded?: DecodedMexcOrder | DecodedMexcTickerData | DecodedMexcTradesData;
  error?: string;
}

export interface MexcSubscription {
  method: 'SUBSCRIPTION' | 'UNSUBSCRIPTION';
  params: string[];
}

export type SubscriptionInfo =
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
      type: 'user_data';
    };
