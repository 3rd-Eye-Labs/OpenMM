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
  GateioRawOrder,
  GateioRawBalance,
  GateioRawTicker,
  GateioRawOrderBook,
  GateioRawTrade,
} from '../../types';
import { GateioUtils } from './gateio-utils';

/**
 * Gate.io Data Mapper
 * Maps Gate.io API responses to OpenMM standard format
 */
export class GateioDataMapper extends BaseExchangeDataMapper<
  GateioRawOrder,
  GateioRawBalance,
  GateioRawTicker,
  GateioRawOrderBook,
  GateioRawTrade,
  GateioRawBalance[]
> {
  /**
   * Map Gate.io order to OpenMM Order format
   */
  mapOrder(gateioOrder: GateioRawOrder): Order {
    if (!gateioOrder) {
      throw new Error('Gate.io order data is required');
    }

    if (!gateioOrder.currency_pair) {
      throw new Error('Order missing currency_pair field');
    }

    const status = GateioDataMapper.mapToOrderStatus(gateioOrder.status);
    const amount = this.parseAmount(gateioOrder.amount);
    const filled = amount - this.parseAmount(gateioOrder.left);

    return {
      id: gateioOrder.id,
      symbol: GateioUtils.fromGateioSymbol(gateioOrder.currency_pair),
      type: this.mapOrderType(gateioOrder.type),
      side: gateioOrder.side.toLowerCase() as OrderSide,
      amount,
      price: gateioOrder.price ? this.parsePrice(gateioOrder.price) : undefined,
      filled,
      remaining: this.parseAmount(gateioOrder.left),
      status,
      timestamp: GateioUtils.parseTimestamp(gateioOrder.create_time),
    };
  }

  /**
   * Map Gate.io order status to OpenMM OrderStatus
   */
  static mapToOrderStatus(status: string): OrderStatus {
    switch (status.toLowerCase()) {
      case 'open':
        return 'open';
      case 'closed':
        return 'filled';
      case 'cancelled':
        return 'cancelled';
      default:
        return 'open';
    }
  }

  /**
   * Map Gate.io order type to OpenMM OrderType
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
   * Map Gate.io balance to OpenMM Balance format
   */
  mapBalance(gateioBalance: GateioRawBalance): Balance {
    const free = this.parseAmount(gateioBalance.available);
    const used = this.parseAmount(gateioBalance.locked);

    return {
      asset: gateioBalance.currency,
      free,
      used,
      total: free + used,
      available: free,
    };
  }

  /**
   * Map Gate.io ticker data to OpenMM Ticker format
   */
  mapTicker(gateioTicker: GateioRawTicker): Ticker {
    return {
      symbol: GateioUtils.fromGateioSymbol(gateioTicker.currency_pair),
      last: this.parsePrice(gateioTicker.last),
      bid: this.parsePrice(gateioTicker.highest_bid),
      ask: this.parsePrice(gateioTicker.lowest_ask),
      baseVolume: this.parseAmount(gateioTicker.base_volume),
      quoteVolume: this.parseAmount(gateioTicker.quote_volume),
      timestamp: Date.now(),
    };
  }

  /**
   * Map Gate.io order book to OpenMM OrderBook format
   */
  mapOrderBook(gateioOrderBook: GateioRawOrderBook, symbol: string): OrderBook {
    return {
      symbol: GateioUtils.fromGateioSymbol(symbol),
      bids: this.parseOrderBookEntries(gateioOrderBook.bids),
      asks: this.parseOrderBookEntries(gateioOrderBook.asks),
      timestamp: GateioUtils.parseTimestamp(gateioOrderBook.current),
    };
  }

  /**
   * Map Gate.io trade to OpenMM Trade format
   */
  mapTrade(gateioTrade: GateioRawTrade, symbol: string): Trade {
    return {
      id: gateioTrade.id,
      symbol: GateioUtils.fromGateioSymbol(symbol),
      side: gateioTrade.side.toLowerCase() as OrderSide,
      amount: this.parseAmount(gateioTrade.amount),
      price: this.parsePrice(gateioTrade.price),
      timestamp: GateioUtils.parseTimestamp(gateioTrade.create_time),
    };
  }

  /**
   * Map Gate.io account response to OpenMM Balance records
   * Gate.io returns array directly: [{currency, available, locked}, ...]
   */
  mapAccountBalances(gateioBalances: GateioRawBalance[]): Record<string, Balance> {
    const balances: Record<string, Balance> = {};

    if (!Array.isArray(gateioBalances)) {
      return balances;
    }

    gateioBalances.forEach((gateioBalance: GateioRawBalance) => {
      const balance = this.mapBalance(gateioBalance);
      balances[balance.asset] = balance;
    });

    return balances;
  }

  /**
   * Map WebSocket order data to OpenMM Order format
   * WebSocket order format is different from REST API format
   */
  mapWebSocketOrder(wsOrderData: any): Order {
    if (!wsOrderData || !wsOrderData.currency_pair) {
      throw new Error('Invalid WebSocket order data');
    }

    const status = this.mapWebSocketOrderStatus(wsOrderData.finish_as, wsOrderData.event);

    const amount = this.parseAmount(wsOrderData.amount);
    const filled = amount - this.parseAmount(wsOrderData.left || '0');
    const price = wsOrderData.price ? this.parsePrice(wsOrderData.price) : undefined;

    return {
      id: wsOrderData.id,
      symbol: GateioUtils.fromGateioSymbol(wsOrderData.currency_pair),
      type: wsOrderData.type === 'market' ? 'market' : 'limit',
      side: wsOrderData.side.toLowerCase() as OrderSide,
      amount,
      price,
      filled,
      remaining: this.parseAmount(wsOrderData.left || '0'),
      status,
      timestamp:
        parseInt(wsOrderData.create_time_ms || wsOrderData.create_time) *
        (wsOrderData.create_time_ms ? 1 : 1000), // Convert seconds to ms if needed
    };
  }

  /**
   * Map WebSocket order status to OpenMM OrderStatus
   * WebSocket uses different status fields (finish_as, event) than REST API
   */
  mapWebSocketOrderStatus(finishAs: string, event: string): OrderStatus {
    if (event === 'finish') {
      if (finishAs === 'cancelled') return 'cancelled';
      if (finishAs === 'filled') return 'filled';
    }

    if (event === 'put' || finishAs === 'open') return 'open';
    if (event === 'update') {
      return 'open';
    }

    return 'open';
  }

  /**
   * Override symbol normalization for Gate.io format
   */
  protected normalizeSymbol(symbol: string): string {
    return GateioUtils.normalizeSymbol(symbol);
  }
}
