/**
 * Gate.io Raw API Response Types
 * Based on actual Gate.io API v4 responses
 */

/**
 * Raw order response from Gate.io
 * GET /spot/orders/{order_id}
 * POST /spot/orders
 */
export interface GateioRawOrder {
  id: string;
  text?: string;
  create_time: string;
  update_time: string;
  create_time_ms?: string;
  update_time_ms?: string;
  currency_pair: string;
  status: 'open' | 'closed' | 'cancelled';
  type: 'limit' | 'market';
  account: 'spot' | 'margin' | 'cross_margin';
  side: 'buy' | 'sell';
  amount: string;
  price: string;
  time_in_force?: 'gtc' | 'ioc' | 'poc' | 'fok';
  left: string;
  filled_total: string;
  fee: string;
  fee_currency: string;
  point_fee?: string;
  gt_fee?: string;
  gt_discount?: boolean;
  rebated_fee?: string;
  rebated_fee_currency?: string;
  iceberg?: string;
  stp_act?: string;
  finish_as?: string;
}

/**
 * Raw balance response from Gate.io
 * GET /spot/accounts
 * Returns array directly (not nested)
 */
export interface GateioRawBalance {
  currency: string;
  available: string;
  locked: string;
}

/**
 * Raw ticker response from Gate.io
 * GET /spot/tickers
 * Returns array of tickers
 */
export interface GateioRawTicker {
  currency_pair: string;
  last: string;
  lowest_ask: string;
  highest_bid: string;
  change_percentage: string;
  change_utc0?: string;
  change_utc8?: string;
  base_volume: string;
  quote_volume: string;
  high_24h: string;
  low_24h: string;
  etf_net_value?: string;
  etf_pre_net_value?: string;
  etf_pre_timestamp?: number;
  etf_leverage?: string;
}

/**
 * Raw order book response from Gate.io
 * GET /spot/order_book
 */
export interface GateioRawOrderBook {
  id: number;
  current: number;
  update: number;
  asks: [string, string][];
  bids: [string, string][];
}

/**
 * Raw trade response from Gate.io
 * GET /spot/trades
 * GET /spot/my_trades (user trades)
 */
export interface GateioRawTrade {
  id: string;
  create_time: string;
  create_time_ms: string;
  order_id?: string;
  currency_pair?: string;
  side: 'buy' | 'sell';
  role?: 'maker' | 'taker';
  amount: string;
  price: string;
  fee?: string;
  fee_currency?: string;
  point_fee?: string;
  gt_fee?: string;
  sequence_id?: string;
  text?: string;
  deal?: string;
}
