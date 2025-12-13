import { Order, OrderBook, Ticker, Trade, OrderType, OrderSide } from '../../types';
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

  setCredentials(credentials: ExchangeCredentials): void {
    this.credentials = credentials;
  }

  protected getCredentials(): ExchangeCredentials {
    if (!this.credentials) {
      throw new Error(`No credentials set for ${this.exchangeName}`);
    }
    return this.credentials;
  }

  // Abstract methods to be implemented by subclasses
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;

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

  // WebSocket methods for real-time data
  abstract connectWebSocket(): Promise<void>;
  abstract disconnectWebSocket(): Promise<void>;
  abstract subscribeTicker(symbol: string, callback: (ticker: Ticker) => void): Promise<string>;
  abstract subscribeOrderBook(symbol: string, callback: (orderbook: OrderBook) => void): Promise<string>;
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
    const message = error instanceof Error 
      ? error.message 
      : typeof error === 'string' 
        ? error 
        : 'Unknown error';
    throw new Error(`${this.exchangeName} ${operation} failed: ${message}`);
  }
}