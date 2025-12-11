import { Order, OrderType, OrderSide, DecodedMexcOrder, MexcRawUserDataOrder } from '../../types';
import { toStandardFormat, toExchangeFormat } from '../../utils/symbol-utils';

/**
 * MEXC Utility Functions
 * Handles MEXC-specific operations like symbol formatting, order parameters, and WebSocket data processing
 *
 * This class focuses on MEXC-specific utilities and WebSocket message processing
 */
export class MexcUtils {

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
  static transformUserDataOrder(mexcOrderData: MexcRawUserDataOrder | DecodedMexcOrder): Order {
    if ('orderId' in mexcOrderData && 'symbol' in mexcOrderData && mexcOrderData.price !== undefined) {
      return this.transformProtobufOrder(mexcOrderData as DecodedMexcOrder);
    }

    const userDataOrder = mexcOrderData as MexcRawUserDataOrder;
    
    const statusMap: { [key: number]: 'open' | 'filled' | 'cancelled' | 'rejected' } = {
      1: 'open',
      2: 'filled',
      3: 'open',
      4: 'cancelled', // Order canceled
      5: 'cancelled'  // Partially filled, then canceled
    };

    const statusCode = userDataOrder.s;
    const status = statusMap[statusCode || 1] || 'open';
    
    const mexcSymbol = userDataOrder.c || userDataOrder.symbol;
    const symbol = mexcSymbol ? this.formatSymbol(mexcSymbol) : '';

    return {
      id: userDataOrder.i?.toString() || Date.now().toString(),
      symbol: symbol,
      type: 'limit',
      side: userDataOrder.S === 1 ? 'buy' : 'sell',
      amount: parseFloat(userDataOrder.v || '0'),
      price: parseFloat(userDataOrder.p || '0'),
      filled: parseFloat(userDataOrder.z || '0'),
      remaining: parseFloat(userDataOrder.v || '0') - parseFloat(userDataOrder.z || '0'),
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
    try {
      return toStandardFormat(mexcSymbol);
    } catch {
      return mexcSymbol;
    }
  }

  /**
   * Convert symbol format from OpenMM standard to MEXC (INDY/USDT -> INDYUSDT)
   */
  static toMexcSymbol(standardSymbol: string): string {
    return toExchangeFormat(standardSymbol);
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

  /**
   * Determine order side from protobuf message patterns
   */
  static determineSide(message: string): 'buy' | 'sell' {
    if (message.includes('R ') || message.includes('@R')) {
      return 'buy';
    } else if (message.includes('H') || message.includes('@H')) {
      return 'sell';
    }
    return 'buy';
  }

  /**
   * Extract order status from protobuf message
   */
  static extractOrderStatus(message: string): string {
    const upperMessage = message.toUpperCase();
    
    if (upperMessage.includes('CANCEL')) {
      return 'cancelled';
    } else if (upperMessage.includes('FILLED') || upperMessage.includes('FILL')) {
      return 'filled';
    } else if (upperMessage.includes('PARTIAL')) {
      return 'partially_filled';
    } else if (upperMessage.includes('EXECUTED') || upperMessage.includes('EXEC')) {
      return 'filled';
    } else if (message.includes('R2') || message.includes('H2') || message.includes('EXE')) {
      return 'filled';
    } else {
      return 'new';
    }
  }
}