import { BaseExchangeConnector } from '../core/exchange/base-exchange-connector';
import { MexcConnector } from '../exchanges/mexc/mexc-connector';

/**
 * Supported exchanges
 */
export type SupportedExchange = 'mexc' | 'gateio' | 'bitget' | 'kraken';

/**
 * Exchange Factory
 * Creates exchange connector instances dynamically based on exchange name
 */
export class ExchangeFactory {
  private static connectors: Map<SupportedExchange, BaseExchangeConnector> = new Map();

  /**
   * Get exchange connector instance
   * @param exchangeName Name of the exchange
   * @returns Exchange connector instance
   */
  static async getExchange(exchangeName: SupportedExchange): Promise<BaseExchangeConnector> {
    if (this.connectors.has(exchangeName)) {
      return this.connectors.get(exchangeName)!;
    }

    const connector = await this.createExchangeConnector(exchangeName);
    await connector.connect();
    
    this.connectors.set(exchangeName, connector);
    
    return connector;
  }

  /**
   * Create exchange connector based on exchange name
   * @param exchangeName Name of the exchange
   * @returns Exchange connector instance
   */
  private static async createExchangeConnector(exchangeName: SupportedExchange): Promise<BaseExchangeConnector> {
    switch (exchangeName) {
      case 'mexc':
        return new MexcConnector();
      
      case 'gateio':
        // TODO: Implement GateIO connector
        throw new Error('GateIO connector not yet implemented');
      
      case 'bitget':
        // TODO: Implement Bitget connector
        throw new Error('Bitget connector not yet implemented');
      
      case 'kraken':
        // TODO: Implement Kraken connector
        throw new Error('Kraken connector not yet implemented');
      
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
}