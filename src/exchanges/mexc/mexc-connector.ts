import { BaseExchangeConnector } from '../../core/exchange/base-exchange-connector';
import { Order, OrderBook, Ticker, Trade, OrderType, OrderSide, Balance, WebSocketStatus } from '../../types';
import { MexcAuth } from './mexc-auth';
import { MexcWebSocket } from './mexc-websocket';
import { MexcUtils } from './mexc-utils';
import { MexcUserStream } from './mexc-user-stream';
import { createLogger } from '../../utils';

/**
 * MEXC Exchange Connector
 */
export class MexcConnector extends BaseExchangeConnector {
  private auth?: MexcAuth;
  private ws?: MexcWebSocket;
  private userStream?: MexcUserStream;
  private readonly baseUrl: string;
  private logger = createLogger('mexc-connector');

  constructor() {
    super('mexc', 'MEXC');
    this.baseUrl = 'https://api.mexc.com/api/v3';
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
        throw new Error('Invalid MEXC credentials');
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
      const balances: Record<string, Balance> = {};

      if (account.balances) {
        account.balances.forEach((balance: any) => {
          if (parseFloat(balance.free) > 0 || parseFloat(balance.locked) > 0) {
            balances[balance.asset] = {
              asset: balance.asset,
              free: parseFloat(balance.free),
              used: parseFloat(balance.locked),
              total: parseFloat(balance.free) + parseFloat(balance.locked),
              available: parseFloat(balance.free)
            };
          }
        });
      }

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

      return MexcUtils.transformOrder({
        orderId: result.orderId,
        symbol: MexcUtils.toMexcSymbol(symbol),
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
        symbol: MexcUtils.toMexcSymbol(symbol), 
        orderId 
      }, 'DELETE');
    } catch (error: unknown) {
      this.handleError(error, 'cancelOrder');
    }
  }

  /**
   * Get order details
   */
  async getOrder(orderId: string, symbol: string): Promise<Order> {
    try {
      const orders = await this.makeRequest('/allOrders', { 
        symbol: MexcUtils.toMexcSymbol(symbol),
        orderId 
      });

      if (!orders || orders.length === 0) {
        throw new Error('Order not found');
      }

      const order = orders[0];
      return MexcUtils.transformOrder(order);
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
        params.symbol = MexcUtils.toMexcSymbol(symbol);
      }

      const orders = await this.makeRequest('/openOrders', params);
      return orders.map((order: any) => MexcUtils.transformOrder(order));
    } catch (error: unknown) {
      this.handleError(error, 'getOpenOrders');
    }
  }

  /**
   * Get ticker information
   */
  async getTicker(symbol: string): Promise<Ticker> {
    try {
      const mexcSymbol = MexcUtils.toMexcSymbol(symbol);
      
      const [priceData, statsData] = await Promise.all([
        this.makePublicRequest('/ticker/price', { symbol: mexcSymbol }),
        this.makePublicRequest('/ticker/24hr', { symbol: mexcSymbol })
      ]);

      return MexcUtils.transformTicker(priceData, statsData);
    } catch (error: unknown) {
      this.handleError(error, 'getTicker');
    }
  }

  /**
   * Get order book
   */
  async getOrderBook(symbol: string): Promise<OrderBook> {
    try {
      const mexcSymbol = MexcUtils.toMexcSymbol(symbol);
      
      const orderBook = await this.makePublicRequest('/depth', { 
        symbol: mexcSymbol,
        limit: 100 
      });

      return MexcUtils.transformOrderBook(orderBook, symbol);
    } catch (error: unknown) {
      this.handleError(error, 'getOrderBook');
    }
  }

  /**
   * Get recent trades
   */
  async getRecentTrades(symbol: string): Promise<Trade[]> {
    try {
      const mexcSymbol = MexcUtils.toMexcSymbol(symbol);
      
      const trades = await this.makePublicRequest('/trades', { 
        symbol: mexcSymbol,
        limit: 100 
      });

      return trades.map((trade: any) => MexcUtils.transformTrade(trade, symbol));
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
        throw new Error('WebSocket not connected. Call connectWebSocket() first.');
      }
      return await this.ws.subscribeTicker(symbol, callback);
    } catch (error: unknown) {
      this.handleError(error, 'subscribeTicker');
    }
  }

  /**
   * Subscribe to real-time order book updates
   */
  async subscribeOrderBook(symbol: string, callback: (orderbook: OrderBook) => void): Promise<string> {
    try {
      if (!this.ws) {
        throw new Error('WebSocket not connected. Call connectWebSocket() first.');
      }
      return await this.ws.subscribeOrderBook(symbol, callback);
    } catch (error: unknown) {
      this.handleError(error, 'subscribeOrderBook');
    }
  }

  /**
   * Subscribe to real-time trade updates
   */
  async subscribeTrades(symbol: string, callback: (trade: Trade) => void): Promise<string> {
    try {
      if (!this.ws) {
        throw new Error('WebSocket not connected. Call connectWebSocket() first.');
      }
      return await this.ws.subscribeTrades(symbol, callback);
    } catch (error: unknown) {
      this.handleError(error, 'subscribeTrades');
    }
  }

  /**
   * Subscribe to real-time order updates (user data)
   */
  async subscribeOrders(callback: (order: Order) => void): Promise<string> {
    try {
      if (!this.ws) {
        throw new Error('WebSocket not connected. Call connectWebSocket() first.');
      }
      return await this.ws.subscribeOrders(callback);
    } catch (error: unknown) {
      this.handleError(error, 'subscribeOrders');
    }
  }

  /**
   * Unsubscribe from a WebSocket subscription
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    try {
      if (!this.ws) {
        throw new Error('WebSocket not connected.');
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
        throw new Error('User stream not initialized');
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
        throw new Error('User stream not initialized');
      }
      return await this.userStream.subscribeUserOrders(callback);
    } catch (error: unknown) {
      this.handleError(error, 'subscribeUserOrders');
    }
  }

  /**
   * Subscribe to real-time user trade executions
   * Notifies when user's orders are filled/executed
   */
  async subscribeUserTrades(callback: (trade: Trade) => void): Promise<string> {
    try {
      if (!this.userStream) {
        throw new Error('User stream not initialized');
      }
      return await this.userStream.subscribeUserTrades(callback);
    } catch (error: unknown) {
      this.handleError(error, 'subscribeUserTrades');
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