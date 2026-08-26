import {
  Order,
  OrderBook,
  Ticker,
  Trade,
  OrderType,
  OrderSide,
  OHLCV,
  OHLCVTimeframe,
} from '../../types';
import { Balance, ExchangeCredentials, WebSocketStatus } from '../../types';

/**
 * Abstract base class for all exchange connectors
 * Provides common functionality and defines the interface that all exchanges must implement
 */
export abstract class BaseExchangeConnector {
  protected readonly exchangeId: string;
  protected readonly exchangeName: string;
  protected credentials?: ExchangeCredentials;
  protected connected: boolean = false;
  /**
   * True when the connector was established via connectPublic() and therefore
   * may only be used for unauthenticated market-data endpoints.
   */
  protected publicOnly: boolean = false;

  constructor(exchangeId: string, exchangeName: string) {
    this.exchangeId = exchangeId;
    this.exchangeName = exchangeName;
  }

  get id(): string {
    return this.exchangeId;
  }

  get name(): string {
    return this.exchangeName;
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Whether this connector can perform authenticated (private) operations.
   *
   * Note: isConnected() returns true for public-only connectors too — use this
   * method when you need to know that credentials are actually usable.
   */
  isAuthenticated(): boolean {
    return this.connected && !this.publicOnly;
  }

  setCredentials(credentials: ExchangeCredentials): void {
    this.credentials = credentials;
  }

  protected getCredentials(): ExchangeCredentials {
    if (!this.credentials) {
      throw new Error(`No credentials set for ${this.exchangeName}`);
    }
    return this.credentials;
  }

  /**
   * Whether usable API credentials are present on this connector.
   */
  protected hasCredentials(): boolean {
    return Boolean(this.credentials?.apiKey && this.credentials?.secret);
  }

  /**
   * Guard for private endpoints. Throws a clear, actionable error when the
   * connector was established in public-only mode.
   */
  protected assertAuthenticated(operation: string): void {
    if (this.publicOnly) {
      throw new Error(
        `${this.exchangeName} is connected in public-only mode: "${operation}" requires API ` +
          `credentials. Configure credentials for ${this.exchangeName} and obtain the connector ` +
          `with requireAuth: true.`
      );
    }
  }

  // Abstract methods to be implemented by subclasses
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  /**
   * Establish a connection limited to public market-data endpoints.
   *
   * Public endpoints (getTicker, getOrderBook, getRecentTrades, getOHLCV) require
   * no authentication, so this path deliberately performs no credential validation.
   * Subclasses that route public traffic through an auth/transport object override
   * this to construct that object without credentials.
   */
  async connectPublic(): Promise<void> {
    this.publicOnly = true;
    this.connected = true;
  }

  // Rest API methods Order management
  abstract getBalance(): Promise<Record<string, Balance>>;
  abstract createOrder(
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price?: number
  ): Promise<Order>;

  abstract cancelOrder(orderId: string, symbol: string): Promise<void>;
  abstract cancelAllOrders(symbol: string): Promise<void>;
  abstract getOrder(orderId: string, symbol: string): Promise<Order>;
  abstract getOpenOrders(symbol?: string): Promise<Order[]>;

  abstract getTicker(symbol: string): Promise<Ticker>;
  abstract getOrderBook(symbol: string): Promise<OrderBook>;
  abstract getRecentTrades(symbol: string): Promise<Trade[]>;
  abstract getOHLCV(symbol: string, timeframe: OHLCVTimeframe, limit?: number): Promise<OHLCV[]>;

  // WebSocket methods for real-time data
  abstract connectWebSocket(): Promise<void>;
  abstract disconnectWebSocket(): Promise<void>;
  abstract subscribeTicker(symbol: string, callback: (ticker: Ticker) => void): Promise<string>;
  abstract subscribeOrderBook(
    symbol: string,
    callback: (orderbook: OrderBook) => void
  ): Promise<string>;
  abstract subscribeTrades(symbol: string, callback: (trade: Trade) => void): Promise<string>;
  abstract subscribeOrders(callback: (order: Order) => void): Promise<string>;
  abstract unsubscribe(subscriptionId: string): Promise<void>;

  abstract isWebSocketConnected(): boolean;
  abstract getWebSocketStatus(): WebSocketStatus;

  // User Data Stream methods for real-time account(user) updates
  abstract connectUserDataStream(): Promise<void>;

  abstract disconnectUserDataStream(): Promise<void>;
  abstract subscribeUserOrders(callback: (order: Order) => void): Promise<string>;
  abstract subscribeUserTrades(callback: (trade: Trade) => void): Promise<string>;
  abstract isUserDataStreamConnected(): boolean;

  // Error handling helper
  protected handleError(error: unknown, operation: string): never {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';
    throw new Error(`${this.exchangeName} ${operation} failed: ${message}`);
  }
}
