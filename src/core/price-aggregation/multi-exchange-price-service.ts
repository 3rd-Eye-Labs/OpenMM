/**
 * Multi-Exchange Price Aggregation Service
 *
 * Fetches prices for supported tokens from multiple exchanges and provides
 * cross-exchange price comparison.
 * Complements the existing Cardano DEX price aggregation.
 */

import { ExchangeFactory, SupportedExchange } from '../../cli/exchange-factory';
import {
  Ticker,
  ExchangePriceData,
  AggregatedExchangePrice,
  DEXvsCEXComparison,
} from '../../types';
import { createLogger } from '../../utils';

/**
 * Multi-Exchange Price Service
 * Aggregates prices across supported exchanges with symbol availability checking
 */
export class MultiExchangePriceService {
  private logger = createLogger('multi-exchange-price');
  private readonly supportedExchanges: SupportedExchange[] = ['mexc', 'gateio', 'bitget'];

  /**
   * Check if a trading symbol exists on a specific exchange
   */
  async isSymbolAvailable(exchange: SupportedExchange, symbol: string): Promise<boolean> {
    try {
      const connector = await ExchangeFactory.getExchange(exchange);

      await connector.getTicker(symbol);
      return true;
    } catch (error) {
      this.logger.debug(`Symbol ${symbol} not available on ${exchange}`, { error });
      return false;
    }
  }

  /**
   * Get price from a specific exchange with error handling
   */
  async getPriceFromExchange(
    exchange: SupportedExchange,
    symbol: string
  ): Promise<ExchangePriceData> {
    const baseResult: ExchangePriceData = {
      exchange,
      symbol,
      price: 0,
      timestamp: new Date(),
      available: false,
    };

    try {
      const isAvailable = await this.isSymbolAvailable(exchange, symbol);

      if (!isAvailable) {
        return {
          ...baseResult,
          available: false,
          error: `Symbol ${symbol} not available on ${exchange}`,
        };
      }

      const connector = await ExchangeFactory.getExchange(exchange);
      const ticker: Ticker = await connector.getTicker(symbol);

      return {
        ...baseResult,
        price: ticker.last,
        available: true,
      };
    } catch (error) {
      this.logger.error(`Failed to get price from ${exchange} for ${symbol}`, { error });
      return {
        ...baseResult,
        available: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get prices from all supported exchanges for a symbol
   */
  async getTokenPriceFromAllExchanges(symbol: string): Promise<ExchangePriceData[]> {
    this.logger.info(`Fetching ${symbol} prices from all exchanges`);

    const pricePromises = this.supportedExchanges.map(exchange =>
      this.getPriceFromExchange(exchange, symbol)
    );

    const results = await Promise.all(pricePromises);

    const availableExchanges = results.filter(r => r.available);
    const unavailableExchanges = results.filter(r => !r.available);

    this.logger.info(
      `${symbol} available on ${availableExchanges.length} exchanges: ${availableExchanges
        .map(r => r.exchange)
        .join(', ')}`
    );

    if (unavailableExchanges.length > 0) {
      this.logger.debug(
        `${symbol} not available on: ${unavailableExchanges.map(r => r.exchange).join(', ')}`
      );
    }

    return results;
  }

  /**
   * Get aggregated price data with analysis
   */
  async getAggregatedPrice(symbol: string): Promise<AggregatedExchangePrice> {
    const prices = await this.getTokenPriceFromAllExchanges(symbol);
    const availablePrices = prices.filter(p => p.available && p.price > 0);

    let averagePrice: number | undefined;

    if (availablePrices.length > 0) {
      const totalPrice = availablePrices.reduce((sum, p) => sum + p.price, 0);
      averagePrice = totalPrice / availablePrices.length;
    }

    return {
      symbol,
      prices,
      averagePrice,
      timestamp: new Date(),
    };
  }

  /**
   * Compare DEX vs CEX prices for Cardano tokens
   */
  async compareDEXvsCEXPrices(symbol: string, dexPrice: number): Promise<DEXvsCEXComparison> {
    const cexPrices = await this.getTokenPriceFromAllExchanges(symbol);
    const availableCexPrices = cexPrices.filter(p => p.available && p.price > 0);

    let averageCexPrice: number | undefined;

    if (availableCexPrices.length > 0) {
      const totalPrice = availableCexPrices.reduce((sum, p) => sum + p.price, 0);
      averageCexPrice = totalPrice / availableCexPrices.length;
    }

    return {
      dexPrice,
      cexPrices,
      averageCexPrice,
    };
  }
}
