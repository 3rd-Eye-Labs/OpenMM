import { BaseExchangeConnector } from '../../core/exchange/base-exchange-connector';
import { Order, OrderBook, Ticker, Trade, OrderType, OrderSide, Balance, WebSocketStatus } from '../../types';
import { MexcAuth } from './mexc-auth';
import { MexcWebSocket } from './mexc-websocket';
import { MexcUtils } from './mexc-utils';
import { MexcUserStream } from './mexc-user-stream';
import { MexcDataMapper } from './mexc-data-mapper';
import { createLogger } from '../../utils';
import { toExchangeFormat } from '../../utils/symbol-utils';
import config from '../../config/environment';

/**
 * MEXC Exchange Connector
 */
export class MexcConnector extends BaseExchangeConnector {
  private auth?: MexcAuth;
  private ws?: MexcWebSocket;
  private userStream?: MexcUserStream;
  private readonly baseUrl: string;
  private readonly dataMapper = new MexcDataMapper();
  private logger = createLogger('mexc-connector');

  constructor() {
    super('mexc', 'MEXC');
    this.baseUrl = 'https://api.mexc.com/api/v3';
    
    this.setCredentials({
      apiKey: config.mexc.apiKey,
      secret: config.mexc.secret,
      uid: config.mexc.uid
    });
  }

  /**
   * Initialize connection and set up authentication
   */
  async connect(): Promise<void> {
    try {
      const credentials = this.getCredentials();
      this.auth = new MexcAuth(credentials, this.baseUrl);
      this.userStream = new MexcUserStream(
        (endpoint: string, params: Record<string, unknown>, method: string) => 
          this.auth!.makeRequest(endpoint, params, method as 'GET' | 'POST' | 'PUT' | 'DELETE')
      );
      
      if (!this.auth.validateCredentials()) {
        this.connected = false;
        this.handleError(new Error('Invalid MEXC credentials'), 'connect');
        return;
      }

      this.connected = true;
    } catch (error: unknown) {
      this.connected = false;
      this.handleError(error, 'connect');
    }
  }

  /**
   * Override disconnect to also disconnect user data stream
   */
  async disconnect(): Promise<void> {
    await this.disconnectWebSocket();
    await this.disconnectUserDataStream();
    this.connected = false;
    this.auth = undefined;
    this.userStream = undefined;
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<Record<string, Balance>>;
  async getBalance(asset: string): Promise<Balance>;
  async getBalance(asset?: string): Promise<Record<string, Balance> | Balance> {
    try {
      const account = await this.makeRequest('/account');
      const balances = this.dataMapper.mapAccountBalances(account);

      if (asset) {
        return balances[asset] || {
          asset,
          free: 0,
          used: 0,
          total: 0,
          available: 0
        };
      }

      return balances;
    } catch (error: unknown) {
      this.handleError(error, 'getBalance');
    }
  }

  /**
   * Create a new order
   */
  async createOrder(
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price?: number
  ): Promise<Order> {
    try {
      const params = MexcUtils.createOrderParams(symbol, type, side, amount, price);

      const result = await this.makeRequest('/order', params, 'POST');

      return this.dataMapper.mapOrder({
        orderId: result.orderId,
        symbol: toExchangeFormat(symbol),
        type: type.toUpperCase(),
        side: side.toUpperCase(),
        origQty: amount.toString(),
        price: price?.toString(),
        executedQty: '0',
        status: 'NEW',
        time: Date.now()
      });
    } catch (error: unknown) {
      this.handleError(error, 'createOrder');
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string, symbol: string): Promise<void> {
    try {
      await this.makeRequest('/order', { 
        symbol: toExchangeFormat(symbol), 
        orderId 
      }, 'DELETE');
    } catch (error: unknown) {
      this.handleError(error, 'cancelOrder');
    }
  }

  /**
   * Cancel all open orders on a symbol
   */
  async cancelAllOrders(symbol: string): Promise<void> {
    try {
      await this.makeRequest('/openOrders', { 
        symbol: toExchangeFormat(symbol)
      }, 'DELETE');
    } catch (error: unknown) {
      this.handleError(error, 'cancelAllOrders');
    }
  }

  /**
   * Get order details
   */
  async getOrder(orderId: string, symbol: string): Promise<Order> {
    try {
      const orders = await this.makeRequest('/allOrders', { 
        symbol: toExchangeFormat(symbol),
        orderId 
      });

      if (!orders || orders.length === 0) {
        this.handleError(new Error('Order not found'), 'getOrder');
        return {} as Order;
      }

      const order = orders[0];
      return this.dataMapper.mapOrder(order);
    } catch (error: unknown) {
      this.handleError(error, 'getOrder');
    }
  }

  /**
   * Get open orders
   */
  async getOpenOrders(symbol?: string): Promise<Order[]> {
    try {
      const params: any = {};
      if (symbol) {
        params.symbol = toExchangeFormat(symbol);
      }

      const orders = await this.makeRequest('/openOrders', params);
      return orders.map((order: any) => this.dataMapper.mapOrder(order));
    } catch (error: unknown) {
      this.handleError(error, 'getOpenOrders');
    }
  }

  /**
   * Get ticker information
   */
  async getTicker(symbol: string): Promise<Ticker> {
    try {
      const mexcSymbol = toExchangeFormat(symbol);
      
      const [priceData, statsData] = await Promise.all([
        this.makePublicRequest('/ticker/price', { symbol: mexcSymbol }),
        this.makePublicRequest('/ticker/24hr', { symbol: mexcSymbol })
      ]);

      return this.dataMapper.mapTicker({ priceData, statsData });
    } catch (error: unknown) {
      this.handleError(error, 'getTicker');
    }
  }

  /**
   * Get order book
   */
  async getOrderBook(symbol: string): Promise<OrderBook> {
    try {
      const mexcSymbol = toExchangeFormat(symbol);
      
      const orderBook = await this.makePublicRequest('/depth', { 
        symbol: mexcSymbol,
        limit: 100 
      });

      return this.dataMapper.mapOrderBook(orderBook, symbol);
    } catch (error: unknown) {
      this.handleError(error, 'getOrderBook');
    }
  }

  /**
   * Get recent trades
   */
  async getRecentTrades(symbol: string): Promise<Trade[]> {
    try {
      const mexcSymbol = toExchangeFormat(symbol);
      
      const trades = await this.makePublicRequest('/trades', { 
        symbol: mexcSymbol,
        limit: 100 
      });

      return trades.map((trade: any) => this.dataMapper.mapTrade(trade, symbol));
    } catch (error: unknown) {
      this.handleError(error, 'getRecentTrades');
    }
  }


  // WebSocket Methods Implementation
  
  /**
   * Connect to MEXC WebSocket for real-time data
   */
  async connectWebSocket(): Promise<void> {
    try {
      if (!this.ws) {
        this.ws = new MexcWebSocket();
      }
      await this.ws.connectWebSocket();
    } catch (error: unknown) {
      this.handleError(error, 'connectWebSocket');
    }
  }

  /**
   * Disconnect from MEXC WebSocket
   */
  async disconnectWebSocket(): Promise<void> {
    try {
      if (this.ws) {
        await this.ws.disconnectWebSocket();
        this.ws = undefined;
      }
    } catch (error: unknown) {
      this.handleError(error, 'disconnectWebSocket');
    }
  }

  /**
   * Subscribe to real-time ticker updates
   */
  async subscribeTicker(symbol: string, callback: (ticker: Ticker) => void): Promise<string> {
    try {
      if (!this.ws) {
        this.handleError(new Error('WebSocket not connected. Call connectWebSocket() first.'), 'subscribeTicker');
        return '';
      }
      return await this.ws.subscribeTicker(symbol, callback);
    } catch (error: unknown) {
      this.handleError(error, 'subscribeTicker');
      return '';
    }
  }

  /**
   * Subscribe to real-time order book updates
   */
  async subscribeOrderBook(symbol: string, callback: (orderbook: OrderBook) => void): Promise<string> {
    try {
      if (!this.ws) {
        this.handleError(new Error('WebSocket not connected. Call connectWebSocket() first.'), 'subscribeOrderBook');
        return '';
      }
      return await this.ws.subscribeOrderBook(symbol, callback);
    } catch (error: unknown) {
      this.handleError(error, 'subscribeOrderBook');
      return '';
    }
  }

  /**
   * Subscribe to real-time trade updates
   */
  async subscribeTrades(symbol: string, callback: (trade: Trade) => void): Promise<string> {
    try {
      if (!this.ws) {
        this.handleError(new Error('WebSocket not connected. Call connectWebSocket() first.'), 'subscribeTrades');
        return '';
      }
      return await this.ws.subscribeTrades(symbol, callback);
    } catch (error: unknown) {
      this.handleError(error, 'subscribeTrades');
      return '';
    }
  }

  /**
   * Subscribe to real-time order updates (user data)
   */
  async subscribeOrders(callback: (order: Order) => void): Promise<string> {
    try {
      if (!this.ws) {
        this.handleError(new Error('WebSocket not connected. Call connectWebSocket() first.'), 'subscribeOrders');
        return '';
      }
      return await this.ws.subscribeOrders(callback);
    } catch (error: unknown) {
      this.handleError(error, 'subscribeOrders');
      return '';
    }
  }

  /**
   * Unsubscribe from a WebSocket subscription
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    try {
      if (!this.ws) {
        this.handleError(new Error('WebSocket not connected.'), 'unsubscribe');
        return;
      }
      await this.ws.unsubscribe(subscriptionId);
    } catch (error: unknown) {
      this.handleError(error, 'unsubscribe');
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isWebSocketConnected(): boolean {
    return this.ws ? this.ws.isConnected() : false;
  }

  /**
   * Get WebSocket connection status
   */
  getWebSocketStatus(): WebSocketStatus {
    return this.ws ? this.ws.getWebSocketStatus() : 'disconnected';
  }

  // User Data Stream Methods for Order Updates

  /**
   * Connect to user data stream for real-time order updates
   */
  async connectUserDataStream(): Promise<void> {
    try {
      if (!this.userStream) {
        this.handleError(new Error('User stream not initialized'), 'connectUserDataStream');
        return;
      }
      await this.userStream.connectUserDataStream();
    } catch (error: unknown) {
      this.handleError(error, 'connectUserDataStream');
    }
  }

  /**
   * Disconnect user data stream
   */
  async disconnectUserDataStream(): Promise<void> {
    try {
      if (this.userStream) {
        await this.userStream.disconnectUserDataStream();
      }
    } catch (error: unknown) {
      this.logger.warn('Error disconnecting user data stream', { error });
    }
  }

  /**
   * Subscribe to real-time user order updates (limit/market orders)
   */
  async subscribeUserOrders(callback: (order: Order) => void): Promise<string> {
    try {
      if (!this.userStream) {
        this.handleError(new Error('User stream not initialized'), 'subscribeUserOrders');
        return '';
      }
      return await this.userStream.subscribeUserOrders(callback);
    } catch (error: unknown) {
      this.handleError(error, 'subscribeUserOrders');
      return '';
    }
  }

  /**
   * Subscribe to real-time user trade executions
   * Notifies when user's orders are filled/executed
   */
  async subscribeUserTrades(callback: (trade: Trade) => void): Promise<string> {
    try {
      if (!this.userStream) {
        this.handleError(new Error('User stream not initialized'), 'subscribeUserTrades');
        return '';
      }
      return await this.userStream.subscribeUserTrades(callback);
    } catch (error: unknown) {
      this.handleError(error, 'subscribeUserTrades');
      return '';
    }
  }

  /**
   * Check if user data stream is connected
   */
  isUserDataStreamConnected(): boolean {
    return this.userStream?.isUserDataStreamConnected() || false;
  }

  /**
   * Make authenticated request to MEXC API
   */
  private async makeRequest(
      endpoint: string,
      params: Record<string, unknown> = {},
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET'
  ): Promise<any> {
    if (!this.auth) {
      throw new Error('MEXC connector not authenticated');
    }
    return this.auth.makeRequest(endpoint, params, method);
  }

  /**
   * Make public request (no authentication required)
   */
  private async makePublicRequest(endpoint: string, params: Record<string, unknown> = {}): Promise<any> {
    if (!this.auth) {
      throw new Error('MEXC connector not authenticated');
    }
    return this.auth.makePublicRequest(endpoint, params);
  }
}