import { Order, OrderType, OrderSide, Ticker, OrderBook, Trade, DecodedMexcOrder } from '../../types';

/**
 * MEXC Utility Functions
 * Handles data transformation between MEXC API format and OpenMM standard format
 */
export class MexcUtils {
  
  /**
   * Transform MEXC order format to OpenMM standard format
   */
  static transformOrder(mexcOrder: any): Order {
    const status = this.transformOrderStatus(mexcOrder.status);
    const filled = parseFloat(mexcOrder.executedQty || '0');
    const amount = parseFloat(mexcOrder.origQty || mexcOrder.quantity || '0');

    return {
      id: mexcOrder.orderId?.toString() || mexcOrder.id?.toString(),
      symbol: this.formatSymbol(mexcOrder.symbol),
      type: mexcOrder.type.toLowerCase() as OrderType,
      side: mexcOrder.side.toLowerCase() as OrderSide,
      amount,
      price: mexcOrder.price ? parseFloat(mexcOrder.price) : undefined,
      filled,
      remaining: amount - filled,
      status,
      timestamp: mexcOrder.time || mexcOrder.updateTime || Date.now()
    };
  }

  /**
   * Transform MEXC order status to OpenMM standard format
   */
  static transformOrderStatus(mexcStatus: string): 'open' | 'filled' | 'cancelled' | 'rejected' {
    switch (mexcStatus) {
      case 'NEW':
      case 'PARTIALLY_FILLED':
        return 'open';
      case 'FILLED':
        return 'filled';
      case 'CANCELED':
      case 'CANCELLED':
        return 'cancelled';
      case 'REJECTED':
      case 'EXPIRED':
        return 'rejected';
      default:
        return 'open';
    }
  }

  /**
   * Transform MEXC ticker data to OpenMM standard format
   */
  static transformTicker(priceData: any, statsData?: any): Ticker {
    return {
      symbol: this.formatSymbol(priceData.symbol),
      last: parseFloat(priceData.price),
      bid: parseFloat(statsData?.bidPrice || priceData.price),
      ask: parseFloat(statsData?.askPrice || priceData.price),
      baseVolume: parseFloat(statsData?.volume || '0'),
      timestamp: Date.now()
    };
  }

  /**
   * Transform MEXC order book data to OpenMM standard format
   */
  static transformOrderBook(mexcOrderBook: any, symbol: string): OrderBook {
    return {
      symbol,
      bids: mexcOrderBook.bids.map((bid: [string, string]) => ({
        price: parseFloat(bid[0]),
        amount: parseFloat(bid[1])
      })),
      asks: mexcOrderBook.asks.map((ask: [string, string]) => ({
        price: parseFloat(ask[0]),
        amount: parseFloat(ask[1])
      })),
      timestamp: Date.now()
    };
  }

  /**
   * Transform MEXC trade data to OpenMM standard format
   */
  static transformTrade(mexcTrade: any, symbol: string): Trade {
    return {
      id: mexcTrade.id?.toString() || mexcTrade.tradeId?.toString() || '',
      symbol,
      side: mexcTrade.isBuyerMaker === false ? 'buy' : 'sell' as OrderSide,
      amount: parseFloat(mexcTrade.qty || mexcTrade.quantity || '0'),
      price: parseFloat(mexcTrade.price || '0'),
      timestamp: mexcTrade.time || Date.now()
    };
  }

  /**
   * Transform MEXC protobuf decoded order to OpenMM standard format
   * Used for protobuf WebSocket user data stream messages
   */
  static transformProtobufOrder(decodedOrder: DecodedMexcOrder): Order {
    const status = this.mapProtobufStatus(decodedOrder.status);
    
    let filled = 0;
    if (status === 'filled') {
      filled = decodedOrder.quantity;
    } else if (status === 'open' && decodedOrder.status.includes('partial')) {
      filled = decodedOrder.quantity;
    } else if (decodedOrder.status === 'filled' || decodedOrder.status.toLowerCase().includes('fill')) {
      filled = decodedOrder.quantity;
    }
    
    const remaining = Math.max(0, decodedOrder.quantity - filled);

    return {
      id: decodedOrder.orderId,
      symbol: decodedOrder.symbol,
      type: 'limit' as OrderType,
      side: decodedOrder.side,
      amount: decodedOrder.quantity,
      price: decodedOrder.price,
      filled,
      remaining,
      status,
      timestamp: decodedOrder.timestamp
    };
  }

  /**
   * Transform MEXC user data order update to OpenMM standard format
   * Used for WebSocket user data stream messages
   */
  static transformUserDataOrder(mexcOrderData: any): Order {
    if (mexcOrderData && mexcOrderData.orderId && mexcOrderData.symbol && mexcOrderData.price !== undefined) {
      return this.transformProtobufOrder(mexcOrderData as DecodedMexcOrder);
    }

    const statusMap: { [key: number]: 'open' | 'filled' | 'cancelled' | 'rejected' } = {
      1: 'open',
      2: 'filled',
      3: 'open',
      4: 'cancelled', // Order canceled
      5: 'cancelled'  // Partially filled, then canceled
    };

    const statusCode = mexcOrderData?.s;
    const status = statusMap[statusCode] || 'open';
    
    const mexcSymbol = mexcOrderData.c || mexcOrderData.symbol || mexcOrderData.s;
    const symbol = this.formatSymbol(mexcSymbol);

    return {
      id: mexcOrderData?.i?.toString() || Date.now().toString(),
      symbol: symbol,
      type: 'limit',
      side: mexcOrderData?.S === 1 ? 'buy' : 'sell',
      amount: parseFloat(mexcOrderData?.v || '0'),
      price: parseFloat(mexcOrderData?.p || '0'),
      filled: parseFloat(mexcOrderData?.z || '0'),
      remaining: parseFloat(mexcOrderData?.v || '0') - parseFloat(mexcOrderData?.z || '0'),
      status,
      timestamp: Date.now()
    };
  }

  /**
   * Map protobuf status strings to OpenMM status
   */
  private static mapProtobufStatus(protobufStatus: string): 'open' | 'filled' | 'cancelled' | 'rejected' {
    switch (protobufStatus.toLowerCase()) {
      case 'new':
        return 'open';
      case 'filled':
        return 'filled';
      case 'partially_filled':
        return 'open';
      case 'cancelled':
      case 'canceled':
        return 'cancelled';
      case 'rejected':
        return 'rejected';
      default:
        return 'open';
    }
  }

  /**
   * Convert symbol format from MEXC to OpenMM standard format
   * Converts formats like BTCUSDT -> BTC/USDT, ETHUSDT -> ETH/USDT, etc.
   */
  static formatSymbol(mexcSymbol: string): string {
    if (!mexcSymbol || mexcSymbol.length < 6) {
      return mexcSymbol;
    }

    const quoteCurrencies = ['USDT', 'USDC', 'BTC', 'ETH', 'BNB', 'BUSD'];
    
    for (const quote of quoteCurrencies) {
      if (mexcSymbol.endsWith(quote)) {
        const base = mexcSymbol.slice(0, -quote.length);
        return `${base}/${quote}`;
      }
    }
    
    // Cases like DOGEUSDT -> DOGE/USDT
    if (mexcSymbol.length >= 7) {
      const base = mexcSymbol.slice(0, -4);
      const quote = mexcSymbol.slice(-4);
      return `${base}/${quote}`;
    }
    
    return mexcSymbol;
  }

  /**
   * Convert symbol format from OpenMM standard to MEXC (INDY/USDT -> INDYUSDT)
   */
  static toMexcSymbol(standardSymbol: string): string {
    return standardSymbol.replace('/', '');
  }

  /**
   * Create order parameters in MEXC format
   */
  static createOrderParams(
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price?: number
  ): Record<string, any> {
    const params: any = {
      symbol: this.toMexcSymbol(symbol),
      side: side.toUpperCase(),
      type: type.toUpperCase(),
      quantity: amount.toString()
    };

    if (type === 'limit' && price) {
      params.price = price.toString();
      params.timeInForce = 'GTC';
    }

    return params;
  }
}