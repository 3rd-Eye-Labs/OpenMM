import { BaseExchangeDataMapper } from '../../core/exchange/base-exchange-data-mapper';
import {
  Order,
  OrderBook,
  Ticker,
  Trade,
  OrderType,
  OrderSide,
  OrderStatus,
  Balance,
} from '../../types';
import {
  BitgetRawOrder,
  BitgetRawBalance,
  BitgetRawAccount,
  BitgetRawTicker,
  BitgetRawOrderBook,
  BitgetRawTrade,
} from '../../types';
import { toStandardFormat } from '../../utils/symbol-utils';

/**
 * Bitget Data Mapper
 * Maps Bitget API responses to OpenMM standard format
 */
export class BitgetDataMapper extends BaseExchangeDataMapper<
  BitgetRawOrder,
  BitgetRawBalance,
  BitgetRawTicker,
  BitgetRawOrderBook,
  BitgetRawTrade,
  BitgetRawAccount
> {
  /**
   * Map Bitget order to OpenMM Order format
   * Handles both REST API and WebSocket order formats
   */
  mapOrder(bitgetOrder: BitgetRawOrder): Order {
    if (!bitgetOrder) {
      throw new Error('Bitget order data is required');
    }

    // Handle symbol field (REST uses 'symbol', WebSocket uses 'instId')
    const symbol = bitgetOrder.symbol || bitgetOrder.instId;
    if (!symbol) {
      throw new Error('Order missing symbol/instId field');
    }

    const status = BitgetDataMapper.mapToOrderStatus(
      bitgetOrder.state || bitgetOrder.status || 'NEW'
    );

    // Handle filled quantity (REST uses 'filledQty', WebSocket uses 'accBaseVolume')
    const filled = this.parseAmount(bitgetOrder.filledQty || bitgetOrder.accBaseVolume || '0');

    const amount = this.parseAmount(bitgetOrder.size);

    return {
      id: bitgetOrder.orderId,
      symbol: toStandardFormat(symbol),
      type: this.mapOrderType(bitgetOrder.orderType),
      side: bitgetOrder.side.toLowerCase() as OrderSide,
      amount,
      price: bitgetOrder.price ? this.parsePrice(bitgetOrder.price) : undefined,
      filled,
      remaining: amount - filled,
      status,
      timestamp: this.parseTimestamp(bitgetOrder.cTime || bitgetOrder.uTime),
    };
  }

  /**
   * Map Bitget order status to OpenMM OrderStatus
   */
  static mapToOrderStatus(status: string): OrderStatus {
    const upperStatus = status.toUpperCase();

    switch (upperStatus) {
      case 'NEW':
      case 'LIVE':
      case 'PARTIALLY_FILLED':
        return 'open';
      case 'FILLED':
        return 'filled';
      case 'CANCELLED':
      case 'CANCELED':
        return 'cancelled';
      case 'REJECTED':
      case 'EXPIRED':
        return 'rejected';
      default:
        return 'open';
    }
  }

  /**
   * Map Bitget order type to OpenMM OrderType
   */
  private mapOrderType(orderType: string): OrderType {
    switch (orderType.toLowerCase()) {
      case 'limit':
        return 'limit';
      case 'market':
        return 'market';
      default:
        return 'limit';
    }
  }

  /**
   * Map Bitget balance to OpenMM Balance format
   */
  mapBalance(bitgetBalance: BitgetRawBalance): Balance {
    const free = this.parseAmount(bitgetBalance.available);
    const used = this.parseAmount(bitgetBalance.frozen || bitgetBalance.locked || '0');

    return {
      asset: bitgetBalance.coin,
      free,
      used,
      total: free + used,
      available: free,
    };
  }

  /**
   * Map Bitget ticker data to OpenMM Ticker format
   */
  mapTicker(bitgetTicker: BitgetRawTicker): Ticker {
    return {
      symbol: toStandardFormat(bitgetTicker.symbol),
      last: this.parsePrice(bitgetTicker.lastPr),
      bid: this.parsePrice(bitgetTicker.bidPr),
      ask: this.parsePrice(bitgetTicker.askPr),
      baseVolume: this.parseAmount(bitgetTicker.baseVolume),
      quoteVolume: this.parseAmount(bitgetTicker.quoteVolume || bitgetTicker.usdtVolume || '0'),
      timestamp: this.parseTimestamp(bitgetTicker.ts),
    };
  }

  /**
   * Map Bitget order book to OpenMM OrderBook format
   */
  mapOrderBook(bitgetOrderBook: BitgetRawOrderBook, symbol: string): OrderBook {
    return {
      symbol: toStandardFormat(symbol),
      bids: this.parseOrderBookEntries(bitgetOrderBook.bids),
      asks: this.parseOrderBookEntries(bitgetOrderBook.asks),
      timestamp: this.parseTimestamp(bitgetOrderBook.ts),
    };
  }

  /**
   * Map Bitget trade to OpenMM Trade format
   */
  mapTrade(bitgetTrade: BitgetRawTrade, symbol: string): Trade {
    return {
      id: bitgetTrade.tradeId,
      symbol: toStandardFormat(symbol),
      side: bitgetTrade.side.toLowerCase() as OrderSide,
      amount: this.parseAmount(bitgetTrade.size),
      price: this.parsePrice(bitgetTrade.price),
      timestamp: this.parseTimestamp(bitgetTrade.ts),
    };
  }

  /**
   * Map Bitget account response to OpenMM Balance records
   */
  mapAccountBalances(bitgetAccount: BitgetRawAccount): Record<string, Balance> {
    const balances: Record<string, Balance> = {};

    bitgetAccount.data.forEach((bitgetBalance: BitgetRawBalance) => {
      const balance = this.mapBalance(bitgetBalance);
      balances[balance.asset] = balance;
    });

    return balances;
  }

  /**
   * Override symbol normalization for Bitget format
   */
  protected normalizeSymbol(symbol: string): string {
    return symbol.toUpperCase();
  }
}
