import { Order, OrderType, OrderSide, DecodedMexcOrder, MexcRawUserDataOrder } from '../../types';
import { MexcDataMapper } from './mexc-data-mapper';
import { toStandardFormat } from '../../utils/symbol-utils';

/**
 * MEXC Utility Functions
 * Handles MEXC-specific operations like symbol formatting, order parameters, and WebSocket data processing
 *
 * This class focuses on MEXC-specific utilities and WebSocket message processing
 */
export class MexcUtils {
  /**
   * Unified order transformation function
   * Handles all MEXC order formats: REST API, WebSocket, Protobuf, User Data
   */
  static transformOrder(orderData: any): Order {
    if (!orderData) {
      throw new Error('Order data is required');
    }

    if (this.isProtobufOrder(orderData)) {
      return this.transformProtobufOrderInternal(orderData);
    } else if (this.isUserDataOrder(orderData)) {
      return this.transformUserDataOrderInternal(orderData);
    } else if (this.isWebSocketUserOrder(orderData)) {
      return this.transformWebSocketUserOrderInternal(orderData);
    } else if (this.isRestApiOrder(orderData)) {
      return this.transformRestApiOrderInternal(orderData);
    } else {
      // Fallback to REST API format for broader compatibility
      return this.transformRestApiOrderInternal(orderData);
    }
  }

  private static isProtobufOrder(data: any): boolean {
    return (
      data &&
      typeof data.orderId === 'string' &&
      typeof data.symbol === 'string' &&
      typeof data.price === 'number' &&
      typeof data.quantity === 'number' &&
      typeof data.side === 'string' &&
      typeof data.status === 'string'
    );
  }

  private static isUserDataOrder(data: any): boolean {
    return (
      data &&
      (data.i !== undefined || data.c !== undefined) &&
      (data.S !== undefined || data.s !== undefined)
    );
  }

  private static isRestApiOrder(data: any): boolean {
    return (
      data &&
      (data.orderId !== undefined || data.id !== undefined) &&
      typeof data.symbol === 'string' &&
      (data.origQty !== undefined || data.quantity !== undefined || data.status !== undefined)
    );
  }

  private static isWebSocketUserOrder(data: any): boolean {
    return (
      data &&
      (data.i !== undefined || data.orderId !== undefined) &&
      (data.s !== undefined || data.symbol !== undefined) &&
      (data.q !== undefined || data.origQty !== undefined) &&
      (data.X !== undefined || data.orderStatus !== undefined)
    );
  }

  private static transformProtobufOrderInternal(decodedOrder: DecodedMexcOrder): Order {
    const status = MexcDataMapper.mapToOrderStatus(decodedOrder.status);

    let filled = 0;
    if (status === 'filled') {
      filled = decodedOrder.quantity;
    } else if (status === 'open' && decodedOrder.status.includes('partial')) {
      filled = decodedOrder.quantity;
    } else if (
      decodedOrder.status === 'filled' ||
      decodedOrder.status.toLowerCase().includes('fill')
    ) {
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
      timestamp: decodedOrder.timestamp,
    };
  }

  private static transformUserDataOrderInternal(userDataOrder: MexcRawUserDataOrder): Order {
    const statusMap: { [key: number]: string } = {
      1: 'new',
      2: 'filled',
      3: 'partially_filled',
      4: 'cancelled',
      5: 'cancelled',
    };

    const statusCode = userDataOrder.s;
    const mexcStatus = statusMap[statusCode || 1] || 'new';
    const status = MexcDataMapper.mapToOrderStatus(mexcStatus);

    const mexcSymbol = userDataOrder.c || userDataOrder.symbol;
    const symbol = mexcSymbol
      ? (() => {
          try {
            return toStandardFormat(mexcSymbol);
          } catch {
            return mexcSymbol;
          }
        })()
      : '';

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
      timestamp: Date.now(),
    };
  }

  private static transformRestApiOrderInternal(mexcOrder: any): Order {
    const status = MexcDataMapper.mapToOrderStatus(mexcOrder.status || 'NEW');
    const filled = parseFloat(mexcOrder.executedQty || '0');
    const amount = parseFloat(mexcOrder.origQty || mexcOrder.quantity || '0');

    return {
      id: (mexcOrder.orderId || mexcOrder.id || mexcOrder.i)?.toString() || '',
      symbol: mexcOrder.symbol || '',
      type: (mexcOrder.type || 'LIMIT').toLowerCase() as OrderType,
      side: (mexcOrder.side || 'BUY').toLowerCase() as OrderSide,
      amount,
      price: mexcOrder.price ? parseFloat(mexcOrder.price) : 0,
      filled,
      remaining: amount - filled,
      status,
      timestamp: parseInt(mexcOrder.time || mexcOrder.updateTime) || Date.now(),
    };
  }

  private static transformWebSocketUserOrderInternal(data: any): Order {
    const mexcSymbol = data.s || data.symbol || '';
    let symbol: string;
    try {
      symbol = toStandardFormat(mexcSymbol);
    } catch {
      symbol = mexcSymbol;
    }

    return {
      id: data.i?.toString() || data.orderId?.toString() || Date.now().toString(),
      symbol: symbol,
      type: (data.o?.toLowerCase() || 'limit') as OrderType,
      side: (data.S?.toLowerCase() || 'buy') as OrderSide,
      amount: parseFloat(data.q || data.origQty || '0'),
      price: parseFloat(data.p || data.price || '0'),
      filled: parseFloat(data.z || data.executedQty || '0'),
      remaining: parseFloat(data.q || '0') - parseFloat(data.z || '0'),
      status: MexcDataMapper.mapToOrderStatus(data.X || data.orderStatus || 'NEW'),
      timestamp: parseInt(data.T || data.transactTime) || Date.now(),
    };
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
}
