import { BaseExchangeDataMapper } from '../../core/exchange/base-exchange-data-mapper';
import { Order, OrderBook, Ticker, Trade, OrderType, OrderSide, OrderStatus } from '../../types';
import { Balance } from '../../types';
import {
  MexcRawOrder,
  MexcRawBalance,
  MexcRawAccount,
  MexcRawPrice,
  MexcRaw24hrStats,
  MexcRawOrderBook,
  MexcRawTrade,
} from '../../types';

/**
 * MEXC Data Mapper
 * Maps MEXC API responses to OpenMM standard format
 */
export class MexcDataMapper extends BaseExchangeDataMapper<
  MexcRawOrder,
  MexcRawBalance,
  { priceData: MexcRawPrice; statsData?: MexcRaw24hrStats },
  MexcRawOrderBook,
  MexcRawTrade,
  MexcRawAccount
> {
  /**
   * Map MEXC order to OpenMM Order format
   */
  mapOrder(mexcOrder: MexcRawOrder): Order {
    if (!mexcOrder) {
      throw new Error('MEXC order data is required');
    }

    const status = MexcDataMapper.mapToOrderStatus(mexcOrder.status || 'NEW');
    const filled = this.parseAmount(mexcOrder.executedQty);
    const amount = this.parseAmount(mexcOrder.origQty || mexcOrder.quantity);

    return {
      id: (mexcOrder.orderId || mexcOrder.id)?.toString() || '',
      symbol: this.normalizeSymbol(mexcOrder.symbol || ''),
      type: (mexcOrder.type || 'LIMIT').toLowerCase() as OrderType,
      side: (mexcOrder.side || 'BUY').toLowerCase() as OrderSide,
      amount,
      price: mexcOrder.price ? this.parsePrice(mexcOrder.price) : undefined,
      filled,
      remaining: amount - filled,
      status,
      timestamp: this.parseTimestamp(mexcOrder.time || mexcOrder.updateTime),
    };
  }

  /**
   * Order status mapping for all MEXC status formats
   * Handles REST API, protobuf, and message pattern statuses
   */
  static mapToOrderStatus(status: string): OrderStatus {
    const upperStatus = status.toUpperCase();

    if (upperStatus.includes('NEW')) return 'open';
    if (upperStatus.includes('PARTIAL')) return 'open';
    if (upperStatus.includes('FILL')) return 'filled';
    if (upperStatus.includes('CANCEL')) return 'cancelled';
    if (upperStatus.includes('REJECT') || upperStatus.includes('EXPIRED')) return 'rejected';
    if (upperStatus.includes('EXEC')) return 'filled';

    return 'open';
  }

  /**
   * Map MEXC balance to OpenMM Balance format
   */
  mapBalance(mexcBalance: MexcRawBalance): Balance {
    const free = this.parseAmount(mexcBalance.free);
    const used = this.parseAmount(mexcBalance.locked);

    return {
      asset: mexcBalance.asset,
      free,
      used,
      total: free + used,
      available: free,
    };
  }

  /**
   * Map MEXC ticker data to OpenMM Ticker format
   */
  mapTicker(tickerData: { priceData: MexcRawPrice; statsData?: MexcRaw24hrStats }): Ticker {
    const { priceData, statsData } = tickerData;

    return {
      symbol: this.normalizeSymbol(priceData.symbol),
      last: this.parsePrice(priceData.price),
      bid: this.parsePrice(statsData?.bidPrice || priceData.price),
      ask: this.parsePrice(statsData?.askPrice || priceData.price),
      baseVolume: this.parseAmount(statsData?.volume || '0'),
      timestamp: Date.now(),
    };
  }

  /**
   * Map MEXC order book to OpenMM OrderBook format
   */
  mapOrderBook(mexcOrderBook: MexcRawOrderBook, symbol: string): OrderBook {
    return {
      symbol: this.normalizeSymbol(symbol),
      bids: this.parseOrderBookEntries(mexcOrderBook.bids),
      asks: this.parseOrderBookEntries(mexcOrderBook.asks),
      timestamp: Date.now(),
    };
  }

  /**
   * Map MEXC trade to OpenMM Trade format
   */
  mapTrade(mexcTrade: MexcRawTrade, symbol: string): Trade {
    return {
      id: (mexcTrade.id || mexcTrade.tradeId)?.toString() || '',
      symbol: this.normalizeSymbol(symbol),
      side: mexcTrade.isBuyerMaker === false ? 'buy' : 'sell',
      amount: this.parseAmount(mexcTrade.qty || mexcTrade.quantity),
      price: this.parsePrice(mexcTrade.price),
      timestamp: this.parseTimestamp(mexcTrade.time),
    };
  }

  /**
   * Map MEXC account response to OpenMM Balance records
   */
  mapAccountBalances(mexcAccount: MexcRawAccount): Record<string, Balance> {
    const balances: Record<string, Balance> = {};

    mexcAccount.balances.forEach((mexcBalance: MexcRawBalance) => {
      const balance = this.mapBalance(mexcBalance);

      if (balance.total > 0) {
        balances[balance.asset] = balance;
      }
    });

    return balances;
  }

  /**
   * Override symbol normalization for MEXC format
   */
  protected normalizeSymbol(symbol: string): string {
    // MEXC uses format like 'BTCUSDT'
    return symbol.toUpperCase();
  }
}
