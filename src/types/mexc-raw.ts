/**
 * MEXC Exchange Raw Data Types
 * Represents the actual data structures returned by MEXC API
 */

/**
 * MEXC Raw Order Response
 */
export interface MexcRawOrder {
  orderId?: string | number;
  id?: string | number;
  symbol: string;
  status: 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'CANCELLED' | 'REJECTED' | 'EXPIRED';
  type: string; // 'LIMIT' | 'MARKET'
  side: string; // 'BUY' | 'SELL'
  origQty?: string;
  quantity?: string;
  executedQty?: string;
  price?: string;
  time?: number;
  updateTime?: number;
}

/**
 * MEXC Raw Balance Response
 */
export interface MexcRawBalance {
  asset: string;
  free: string;
  locked: string;
}

/**
 * MEXC Raw Account Response
 */
export interface MexcRawAccount {
  balances: MexcRawBalance[];
}

/**
 * MEXC Raw Price Data (for ticker)
 */
export interface MexcRawPrice {
  symbol: string;
  price: string;
}

/**
 * MEXC Raw 24hr Stats (for ticker)
 */
export interface MexcRaw24hrStats {
  symbol: string;
  bidPrice?: string;
  askPrice?: string;
  volume?: string;
  priceChange?: string;
  priceChangePercent?: string;
}

/**
 * MEXC Raw Order Book Response
 */
export interface MexcRawOrderBook {
  bids: [string, string][]; // [price, quantity]
  asks: [string, string][]; // [price, quantity]
}

/**
 * MEXC Raw Trade Response
 */
export interface MexcRawTrade {
  id?: string | number;
  tradeId?: string | number;
  price: string;
  qty?: string;
  quantity?: string;
  time?: number;
  isBuyerMaker?: boolean;
}

/**
 * MEXC Raw WebSocket User Data Order Update
 * Used for WebSocket user data stream messages
 */
export interface MexcRawUserDataOrder {
  i?: string | number;  // order id
  c?: string;           // symbol (MEXC format like BTCUSDT)
  s?: number;           // status code (1: open, 2: filled, 3: open, 4: cancelled, 5: partially filled then cancelled)
  S?: number;           // side (1: buy, other: sell)
  v?: string;           // volume/quantity
  p?: string;           // price
  z?: string;           // filled quantity
  symbol?: string;
}