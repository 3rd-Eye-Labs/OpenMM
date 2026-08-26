import { BaseExchangeConnector } from '../core/exchange/base-exchange-connector';
import { MexcConnector } from '../exchanges/mexc/mexc-connector';
import { BitgetConnector } from '../exchanges/bitget/bitget-connector';
import { GateioConnector } from '../exchanges/gateio/gateio-connector';
import { KrakenConnector } from '../exchanges/kraken/kraken-connector';

/**
 * Supported exchanges
 */
export type SupportedExchange = 'mexc' | 'gateio' | 'bitget' | 'kraken';

/**
 * Options for {@link ExchangeFactory.getExchange}
 */
export interface GetExchangeOptions {
  /**
   * Whether the connector must be able to perform authenticated operations.
   *
   * Defaults to `true`, preserving the historical behaviour of requiring valid
   * API credentials. Pass `false` for public market-data endpoints (ticker,
   * order book, recent trades, OHLCV), which need no authentication.
   */
  requireAuth?: boolean;
}

/**
 * Exchange Factory
 * Creates exchange connector instances dynamically based on exchange name
 */
export class ExchangeFactory {
  private static connectors: Map<string, BaseExchangeConnector> = new Map();

  /**
   * Build the cache key for a connector.
   *
   * Public-only and authenticated connectors for the same exchange are distinct
   * instances and must never be shared: handing a public-only connector to a
   * caller that needs to place orders would fail even when credentials exist.
   */
  private static cacheKey(exchangeName: SupportedExchange, requireAuth: boolean): string {
    return `${exchangeName}:${requireAuth ? 'auth' : 'public'}`;
  }

  /**
   * Get exchange connector instance
   * @param exchangeName Name of the exchange
   * @param options Connection options; defaults to requiring authentication
   * @returns Exchange connector instance
   */
  static async getExchange(
    exchangeName: SupportedExchange,
    options: GetExchangeOptions = {}
  ): Promise<BaseExchangeConnector> {
    const requireAuth = options.requireAuth !== false;
    const key = this.cacheKey(exchangeName, requireAuth);

    const cached = this.connectors.get(key);
    if (cached) {
      return cached;
    }

    // An authenticated connector can serve public requests too, so reuse one if
    // it already exists rather than opening a second connection.
    if (!requireAuth) {
      const authenticated = this.connectors.get(this.cacheKey(exchangeName, true));
      if (authenticated) {
        return authenticated;
      }
    }

    const connector = await this.createExchangeConnector(exchangeName);

    if (requireAuth) {
      await connector.connect();
    } else {
      await connector.connectPublic();
    }

    this.connectors.set(key, connector);

    return connector;
  }

  /**
   * Create exchange connector based on exchange name
   * @param exchangeName Name of the exchange
   * @returns Exchange connector instance
   */
  private static async createExchangeConnector(
    exchangeName: SupportedExchange
  ): Promise<BaseExchangeConnector> {
    switch (exchangeName) {
      case 'mexc':
        return new MexcConnector();

      case 'gateio':
        return new GateioConnector();

      case 'bitget':
        return new BitgetConnector();

      case 'kraken':
        return new KrakenConnector();

      default:
        throw new Error(`Unsupported exchange: ${exchangeName}`);
    }
  }

  /**
   * Get list of supported exchanges
   * @returns Array of supported exchange names
   */
  static getSupportedExchanges(): SupportedExchange[] {
    return ['mexc', 'gateio', 'bitget', 'kraken'];
  }

  /**
   * Check if exchange is supported
   * @param exchangeName Exchange name to check
   * @returns True if exchange is supported
   */
  static isSupported(exchangeName: string): exchangeName is SupportedExchange {
    return this.getSupportedExchanges().includes(exchangeName as SupportedExchange);
  }

  /**
   * Disconnect all cached connectors
   */
  static async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.connectors.values()).map(connector => {
      if (connector.disconnect) {
        return connector.disconnect();
      }
      return Promise.resolve();
    });

    await Promise.all(disconnectPromises);
    this.connectors.clear();
  }

  /**
   * Clear a specific connector from cache (forces re-creation on next call)
   *
   * Clears both the authenticated and the public-only connector for the exchange.
   */
  static clearConnector(exchangeName: SupportedExchange): void {
    for (const requireAuth of [true, false]) {
      const key = this.cacheKey(exchangeName, requireAuth);
      const connector = this.connectors.get(key);
      if (connector?.disconnect) {
        connector.disconnect().catch(() => {});
      }
      this.connectors.delete(key);
    }
  }

  /**
   * Clear all cached connectors (forces re-creation on next call)
   */
  static clearAllConnectors(): void {
    this.disconnectAll().catch(() => {});
  }
}
