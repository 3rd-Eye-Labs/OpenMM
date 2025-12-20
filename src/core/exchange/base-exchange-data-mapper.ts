import { Order, OrderBook, Ticker, Trade } from '../../types';
import { Balance } from '../../types';

/**
 * Abstract base class for exchange data mappers
 * Maps exchange-specific data formats to OpenMM standard format
 *
 */
export abstract class BaseExchangeDataMapper<
  TRawOrder = unknown,
  TRawBalance = unknown,
  TRawTicker = unknown,
  TRawOrderBook = unknown,
  TRawTrade = unknown,
  TRawAccount = unknown,
> {
  /**
   * Map exchange-specific order format to OpenMM Order
   */
  abstract mapOrder(exchangeOrder: TRawOrder): Order;

  /**
   * Map exchange-specific balance format to OpenMM Balance
   */
  abstract mapBalance(exchangeBalance: TRawBalance): Balance;

  /**
   * Map exchange-specific ticker format to OpenMM Ticker
   */
  abstract mapTicker(exchangeTicker: TRawTicker): Ticker;

  /**
   * Map exchange-specific order book format to OpenMM OrderBook
   */
  abstract mapOrderBook(exchangeOrderBook: TRawOrderBook, symbol: string): OrderBook;

  /**
   * Map exchange-specific trade format to OpenMM Trade
   */
  abstract mapTrade(exchangeTrade: TRawTrade, symbol: string): Trade;

  /**
   * Map exchange-specific account format to OpenMM Balance records
   * Used when getting all balances from account endpoint
   */
  abstract mapAccountBalances(exchangeAccount: TRawAccount): Record<string, Balance>;

  /**
   * Parse timestamp from various formats to number
   */
  protected parseTimestamp(timestamp: string | number | undefined | null): number {
    if (!timestamp) return Date.now();
    if (typeof timestamp === 'number') return timestamp;
    const parsed = parseInt(timestamp, 10);
    return isNaN(parsed) ? Date.now() : parsed;
  }

  /**
   * Parse price from string to number
   */
  protected parsePrice(price: string | number | undefined | null): number {
    if (!price) return 0;
    if (typeof price === 'number') return price;
    const parsed = parseFloat(price);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Parse amount/quantity from string to number
   */
  protected parseAmount(amount: string | number | undefined | null): number {
    if (!amount) return 0;
    if (typeof amount === 'number') return amount;
    const parsed = parseFloat(amount);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Normalize symbol format to OpenMM standard
   */
  protected normalizeSymbol(symbol: string): string {
    return symbol.toUpperCase();
  }

  /**
   * Parse order book entries from exchange format
   */
  protected parseOrderBookEntries(
    entries: [string, string][]
  ): Array<{ price: number; amount: number }> {
    return entries.map(([price, amount]) => ({
      price: this.parsePrice(price),
      amount: this.parseAmount(amount),
    }));
  }
}
