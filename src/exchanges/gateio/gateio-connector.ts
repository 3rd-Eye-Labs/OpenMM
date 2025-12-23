import { BaseExchangeConnector } from '../../core/exchange/base-exchange-connector';
import {
  Order,
  OrderBook,
  Ticker,
  Trade,
  OrderType,
  OrderSide,
  Balance,
  ExchangeCredentials,
  WebSocketStatus,
  GateioRawOrder,
  GateioRawBalance,
  GateioRawOrderBook,
  GateioRawTrade,
} from '../../types';
import { GateioAuth } from './gateio-auth';
import { GateioUtils } from './gateio-utils';
import { GateioDataMapper } from './gateio-data-mapper';
import { GateioWebSocket } from './gateio-websocket';
import { GateioUserDataStream } from './gateio-user-stream';
import { createLogger, ExchangeUtils } from '../../utils';

/**
 * Gate.io Exchange Connector
 *
 * Implements the BaseExchangeConnector interface for Gate.io exchange.
 * Provides trading operations, market data access, and WebSocket streaming.
 */
export class GateioConnector extends BaseExchangeConnector {
  private auth?: GateioAuth;
  private webSocket?: GateioWebSocket;
  private userDataStream?: GateioUserDataStream;
  private logger = createLogger('gateio-connector');
  private readonly baseUrl = 'https://api.gateio.ws';
  private readonly dataMapper = new GateioDataMapper();

  constructor(credentials?: ExchangeCredentials) {
    super('gateio', 'Gate.io');
    this.logger.info('GateioConnector initialized');

    if (credentials) {
      this.setCredentials(credentials);
    }
  }

  /**
   * Set API credentials and initialize authentication handler
   *
   * @param credentials - Gate.io API credentials (apiKey and secret only)
   * @throws Error if credentials are missing required fields
   */
  setCredentials(credentials: ExchangeCredentials): void {
    super.setCredentials(credentials);

    if (!credentials.apiKey || !credentials.secret) {
      throw new Error('Invalid Gate.io credentials: missing apiKey or secret');
    }

    this.auth = new GateioAuth(credentials, this.baseUrl);
  }

  /**
   * Connect to Gate.io API by testing server time and validating credentials
   *
   * @returns Promise that resolves when successfully connected to Gate.io API
   * @throws Error if connection fails or credentials are invalid
   */
  async connect(): Promise<void> {
    try {
      const credentials = this.getCredentials();
      this.auth = new GateioAuth(credentials, this.baseUrl);

      const timeResponse = await this.auth.makePublicRequest('/spot/time');

      if (!timeResponse || !timeResponse.server_time) {
        throw new Error('Invalid response from Gate.io time endpoint');
      }

      const serverTime = GateioUtils.parseTimestamp(timeResponse.server_time);
      const localTime = Date.now();

      if (!this.auth.validateCredentialsExist()) {
        this.connected = false;
        this.handleError(new Error('Invalid Gate.io credentials'), 'connect');
        return;
      }

      try {
        await this.auth.makeRequest('/spot/accounts');
      } catch (credError) {
        if (credError instanceof Error) {
          const errorMessage = GateioUtils.mapErrorMessage(credError);
          throw new Error(`Credentials validation failed: ${errorMessage}`);
        }
      }

      this.connected = true;
      this.logger.info('Connected to Gate.io API', {
        serverTime,
        localTime,
        timeDiff: Math.abs(serverTime - localTime),
      });
    } catch (error) {
      this.connected = false;
      this.handleError(error, 'connect');
    }
  }

  /**
   * Disconnect from Gate.io API and clean up resources
   *
   * @returns Promise that resolves when successfully disconnected from Gate.io API
   */
  async disconnect(): Promise<void> {
    try {
      await this.disconnectWebSocket();
      await this.disconnectUserDataStream();

      this.connected = false;
      this.auth = undefined;
    } catch (error) {
      this.handleError(error, 'disconnect');
    }
  }

  // =============================================================================
  // REST API Methods Implementation
  // =============================================================================

  /**
   * Get account balance for all assets
   *
   * @returns Promise resolving to balance data for all assets
   * @throws Error if API request fails or credentials are invalid
   */
  async getBalance(): Promise<Record<string, Balance>> {
    try {
      if (!this.auth) {
        throw new Error('Gate.io connector not authenticated');
      }

      const response = await this.auth.makeRequest('/spot/accounts');

      if (!Array.isArray(response)) {
        throw new Error('Invalid response from Gate.io accounts endpoint - expected array');
      }

      return this.dataMapper.mapAccountBalances(response as GateioRawBalance[]);
    } catch (error: unknown) {
      const errorMessage = GateioUtils.mapErrorMessage(error);
      this.logger.error('Get balance failed', { error: errorMessage });
      this.handleError(new Error(errorMessage), 'getBalance');
    }
  }

  /**
   * Create a new order on Gate.io exchange
   *
   * @param symbol - Trading pair symbol (e.g., 'SNEK/USDT')
   * @param type - Order type ('market' or 'limit')
   * @param side - Order side ('buy' or 'sell')
   * @param amount - Order quantity/amount
   * @param price - Optional. Price for limit orders (required for limit orders)
   * @returns Promise resolving to the created order details
   * @throws Error if order creation fails or parameters are invalid
   */
  async createOrder(
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price?: number
  ): Promise<Order> {
    try {
      if (!this.auth) {
        throw new Error('Gate.io connector not authenticated');
      }

      if (!GateioUtils.isValidSymbol(symbol)) {
        throw new Error(`Invalid symbol format: ${symbol}`);
      }

      const orderRequest = ExchangeUtils.createGateioOrderParams(symbol, type, side, amount, price);

      const response = await this.auth.makeRequest('/spot/orders', {}, 'POST', orderRequest);

      if (!response || !GateioUtils.isValidOrderResponse(response)) {
        throw new Error('Invalid response from Gate.io place-order endpoint');
      }

      this.logger.info('Order created successfully', {
        orderId: response.id,
        symbol: orderRequest.currency_pair,
        side,
        amount,
        price,
      });

      return this.dataMapper.mapOrder(response as GateioRawOrder);
    } catch (error: unknown) {
      const errorMessage = GateioUtils.mapErrorMessage(error);
      this.logger.error('Create order failed', {
        symbol,
        type,
        side,
        amount,
        price,
        error: errorMessage,
      });
      this.handleError(new Error(errorMessage), 'createOrder');
    }
  }

  /**
   * Cancel an existing order on Gate.io exchange
   *
   * @param orderId - The ID of the order to cancel
   * @param symbol - Trading pair symbol (e.g., 'SNEK/USDT')
   * @returns Promise that resolves when order is successfully cancelled
   * @throws Error if cancellation fails or order not found
   */
  async cancelOrder(orderId: string, symbol: string): Promise<void> {
    try {
      if (!this.auth) {
        throw new Error('Gate.io connector not authenticated');
      }

      if (!orderId) {
        throw new Error('Order ID is required');
      }

      if (!GateioUtils.isValidSymbol(symbol)) {
        throw new Error(`Invalid symbol format: ${symbol}`);
      }

      const currencyPair = GateioUtils.toGateioSymbol(symbol);

      await this.auth.makeRequest(
        `/spot/orders/${orderId}`,
        { currency_pair: currencyPair },
        'DELETE'
      );
    } catch (error: unknown) {
      const errorMessage = GateioUtils.mapErrorMessage(error);
      this.logger.error('Cancel order failed', { orderId, symbol, error: errorMessage });
      this.handleError(new Error(errorMessage), 'cancelOrder');
    }
  }

  /**
   * Cancel all open orders for a specific symbol using batch delete endpoint
   *
   * Uses Gate.io's DELETE /spot/orders endpoint to cancel all orders in a single request,
   * which is more efficient than canceling orders one by one.
   *
   * @param symbol - Trading pair symbol (e.g., 'SNEK/USDT')
   * @returns Promise that resolves when all orders are cancelled
   * @throws Error if cancellation fails
   */
  async cancelAllOrders(symbol: string): Promise<void> {
    try {
      if (!this.auth) {
        throw new Error('Gate.io connector not authenticated');
      }

      if (!GateioUtils.isValidSymbol(symbol)) {
        throw new Error(`Invalid symbol format: ${symbol}`);
      }

      const currencyPair = GateioUtils.toGateioSymbol(symbol);

      await this.auth.makeRequest('/spot/orders', { currency_pair: currencyPair }, 'DELETE');
    } catch (error: unknown) {
      const errorMessage = GateioUtils.mapErrorMessage(error);
      this.logger.error('Cancel all orders failed', { symbol, error: errorMessage });
      this.handleError(new Error(errorMessage), 'cancelAllOrders');
    }
  }

  /**
   * Get details of a specific order by ID
   *
   * @param orderId - The ID of the order to retrieve
   * @param symbol - Trading pair symbol (e.g., 'SNEK/USDT')
   * @returns Promise resolving to order details
   * @throws Error if order not found or request fails
   */
  async getOrder(orderId: string, symbol: string): Promise<Order> {
    try {
      if (!this.auth) {
        throw new Error('Gate.io connector not authenticated');
      }

      if (!orderId) {
        throw new Error('Order ID is required');
      }

      if (!GateioUtils.isValidSymbol(symbol)) {
        throw new Error(`Invalid symbol format: ${symbol}`);
      }

      const currencyPair = GateioUtils.toGateioSymbol(symbol);

      const response = await this.auth.makeRequest(`/spot/orders/${orderId}`, {
        currency_pair: currencyPair,
      });

      if (!response || !GateioUtils.isValidOrderResponse(response)) {
        throw new Error('Order not found or invalid response');
      }

      return this.dataMapper.mapOrder(response as GateioRawOrder);
    } catch (error: unknown) {
      const errorMessage = GateioUtils.mapErrorMessage(error);
      this.logger.error('Get order failed', { orderId, symbol, error: errorMessage });
      this.handleError(new Error(errorMessage), 'getOrder');
    }
  }

  /**
   * Get all open orders, optionally filtered by symbol
   *
   * @param symbol - Optional. Trading pair symbol to filter orders (e.g., 'SNEK/USDT')
   * @returns Promise resolving to array of open orders
   * @throws Error if request fails
   */
  async getOpenOrders(symbol?: string): Promise<Order[]> {
    try {
      if (!this.auth) {
        throw new Error('Gate.io connector not authenticated');
      }

      const params: Record<string, unknown> = {};

      if (symbol) {
        if (!GateioUtils.isValidSymbol(symbol)) {
          throw new Error(`Invalid symbol format: ${symbol}`);
        }
        params.currency_pair = GateioUtils.toGateioSymbol(symbol);
      }

      const response = await this.auth.makeRequest('/spot/open_orders', params);

      if (!Array.isArray(response)) {
        this.logger.warn('Gate.io open orders returned unexpected format', { response });
        return [];
      }

      const allOrders = GateioUtils.extractOrdersFromOpenOrdersResponse(response);

      return allOrders.map((orderData: unknown) =>
        this.dataMapper.mapOrder(orderData as GateioRawOrder)
      );
    } catch (error: unknown) {
      const errorMessage = GateioUtils.mapErrorMessage(error);
      this.logger.error('Get open orders failed', { symbol, error: errorMessage });
      this.handleError(new Error(errorMessage), 'getOpenOrders');
    }
  }

  /**
   * Get ticker information for a trading pair
   *
   * @param symbol - Trading pair symbol (e.g., 'SNEK/USDT')
   * @returns Promise resolving to ticker data including prices and volume
   * @throws Error if ticker data not found or request fails
   */
  async getTicker(symbol: string): Promise<Ticker> {
    try {
      if (!GateioUtils.isValidSymbol(symbol)) {
        throw new Error(`Invalid symbol format: ${symbol}`);
      }

      const currencyPair = GateioUtils.toGateioSymbol(symbol);
      const response = await this.makePublicRequest('/spot/tickers', {
        currency_pair: currencyPair,
      });

      if (!Array.isArray(response) || response.length === 0) {
        throw new Error('No ticker data found');
      }

      return this.dataMapper.mapTicker(response[0]);
    } catch (error: unknown) {
      const errorMessage = GateioUtils.mapErrorMessage(error);
      this.logger.error('Get ticker failed', { symbol, error: errorMessage });
      this.handleError(new Error(errorMessage), 'getTicker');
    }
  }

  /**
   * Get order book data for a trading pair
   *
   * @param symbol - Trading pair symbol (e.g., 'SNEK/USDT')
   * @returns Promise resolving to order book with bids and asks
   * @throws Error if order book data not found or request fails
   */
  async getOrderBook(symbol: string): Promise<OrderBook> {
    try {
      if (!GateioUtils.isValidSymbol(symbol)) {
        throw new Error(`Invalid symbol format: ${symbol}`);
      }

      const currencyPair = GateioUtils.toGateioSymbol(symbol);

      const response = await this.makePublicRequest('/spot/order_book', {
        currency_pair: currencyPair,
        limit: '100',
      });

      if (!response) {
        throw new Error('No order book data found');
      }

      return this.dataMapper.mapOrderBook(response as GateioRawOrderBook, currencyPair);
    } catch (error: unknown) {
      const errorMessage = GateioUtils.mapErrorMessage(error);
      this.logger.error('Get order book failed', { symbol, error: errorMessage });
      this.handleError(new Error(errorMessage), 'getOrderBook');
    }
  }

  /**
   * Get recent trades for a trading pair
   *
   * @param symbol - Trading pair symbol (e.g., 'SNEK/USDT')
   * @returns Promise resolving to array of recent trade executions
   * @throws Error if request fails
   */
  async getRecentTrades(symbol: string): Promise<Trade[]> {
    try {
      if (!GateioUtils.isValidSymbol(symbol)) {
        throw new Error(`Invalid symbol format: ${symbol}`);
      }

      const currencyPair = GateioUtils.toGateioSymbol(symbol);

      const response = await this.makePublicRequest('/spot/trades', {
        currency_pair: currencyPair,
        limit: '100',
      });

      if (!Array.isArray(response)) {
        this.logger.warn('Gate.io recent trades returned unexpected format', { response });
        return [];
      }

      return response.map((tradeData: unknown) =>
        this.dataMapper.mapTrade(tradeData as GateioRawTrade, currencyPair)
      );
    } catch (error: unknown) {
      const errorMessage = GateioUtils.mapErrorMessage(error);
      this.logger.error('Get recent trades failed', { symbol, error: errorMessage });
      this.handleError(new Error(errorMessage), 'getRecentTrades');
    }
  }

  // =============================================================================
  // WebSocket Methods
  // =============================================================================

  /**
   * Connect to Gate.io WebSocket for real-time data
   */
  async connectWebSocket(): Promise<void> {
    try {
      if (this.webSocket?.isConnected()) {
        return;
      }

      if (!this.webSocket) {
        this.webSocket = new GateioWebSocket('wss://api.gateio.ws/ws/v4/');
      }

      await this.webSocket.connectWebSocket();
    } catch (error) {
      this.logger.error('Failed to connect Gate.io WebSocket', { error });
      this.handleError(error, 'connectWebSocket');
    }
  }

  /**
   * Disconnect from Gate.io WebSocket
   */
  async disconnectWebSocket(): Promise<void> {
    try {
      if (!this.webSocket) {
        return;
      }

      await this.webSocket.disconnectWebSocket();
      this.webSocket = undefined;
    } catch (error) {
      this.logger.error('Failed to disconnect Gate.io WebSocket', { error });
    }
  }

  /**
   * Subscribe to real-time ticker updates for a trading pair
   */
  async subscribeTicker(symbol: string, callback: (ticker: Ticker) => void): Promise<string> {
    try {
      if (!this.webSocket) {
        await this.connectWebSocket();
      }

      if (!this.webSocket) {
        throw new Error('Failed to initialize WebSocket connection');
      }

      return this.webSocket.subscribeTicker(symbol, callback);
    } catch (error) {
      this.logger.error('Failed to subscribe to ticker', { symbol, error });
      this.handleError(error, 'subscribeTicker');
    }
  }

  /**
   * Subscribe to real-time order book updates for a trading pair
   */
  async subscribeOrderBook(
    symbol: string,
    callback: (orderbook: OrderBook) => void
  ): Promise<string> {
    try {
      if (!this.webSocket) {
        await this.connectWebSocket();
      }

      if (!this.webSocket) {
        throw new Error('Failed to initialize WebSocket connection');
      }

      return this.webSocket.subscribeOrderBook(symbol, callback);
    } catch (error) {
      this.logger.error('Failed to subscribe to order book', { symbol, error });
      this.handleError(error, 'subscribeOrderBook');
    }
  }

  /**
   * Subscribe to real-time trade updates for a trading pair
   */
  async subscribeTrades(symbol: string, callback: (trade: Trade) => void): Promise<string> {
    try {
      if (!this.webSocket) {
        await this.connectWebSocket();
      }

      if (!this.webSocket) {
        throw new Error('Failed to initialize WebSocket connection');
      }

      return this.webSocket.subscribeTrades(symbol, callback);
    } catch (error) {
      this.logger.error('Failed to subscribe to trades', { symbol, error });
      this.handleError(error, 'subscribeTrades');
    }
  }

  /**
   * Subscribe to real-time order updates (user data)
   * Uses Gate.io UserDataStream for authenticated order updates
   */
  async subscribeOrders(callback: (order: Order) => void): Promise<string> {
    try {
      if (!this.userDataStream) {
        await this.connectUserDataStream();
      }

      if (!this.userDataStream) {
        throw new Error('User Data Stream not initialized. Call connectUserDataStream() first.');
      }

      return await this.userDataStream.subscribeUserOrders(callback);
    } catch (error: unknown) {
      this.logger.error('Failed to subscribe to orders', { error });
      this.handleError(error, 'subscribeOrders');
      return '';
    }
  }

  /**
   * Unsubscribe from a WebSocket subscription
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    try {
      if (!this.webSocket) {
        this.logger.warn('No WebSocket instance to unsubscribe from');
        return;
      }

      this.webSocket.unsubscribe(subscriptionId);
    } catch (error) {
      this.logger.error('Failed to unsubscribe', { subscriptionId, error });
    }
  }

  /**
   * Check if WebSocket connection is active
   */
  isWebSocketConnected(): boolean {
    return this.webSocket?.isConnected() ?? false;
  }

  /**
   * Get current WebSocket connection status
   */
  getWebSocketStatus(): WebSocketStatus {
    return this.webSocket?.getWebSocketStatus() ?? 'disconnected';
  }

  // =============================================================================
  // User Data Stream Methods
  // =============================================================================

  /**
   * Connect to user data stream for real-time account updates
   * Uses dedicated GateioUserDataStream class following Bitget/MEXC pattern
   */
  async connectUserDataStream(): Promise<void> {
    try {
      if (!this.auth) {
        throw new Error('Authentication required. Call connect() first.');
      }

      const credentials = this.getCredentials();
      if (!this.userDataStream) {
        this.userDataStream = new GateioUserDataStream(credentials);
      }

      await this.userDataStream.connectUserDataStream();
    } catch (error: unknown) {
      this.handleError(error, 'connectUserDataStream');
    }
  }

  /**
   * Disconnect from user data stream
   */
  async disconnectUserDataStream(): Promise<void> {
    try {
      if (this.userDataStream) {
        await this.userDataStream.disconnectUserDataStream();
        this.userDataStream = undefined;
      }
    } catch (error: unknown) {
      this.handleError(error, 'disconnectUserDataStream');
    }
  }

  /**
   * Subscribe to real-time user order updates
   * Uses Gate.io's spot.orders channel for authenticated order updates
   */
  async subscribeUserOrders(callback: (order: Order) => void): Promise<string> {
    try {
      if (!this.userDataStream) {
        throw new Error('User Data Stream not initialized. Call connectUserDataStream() first.');
      }
      return await this.userDataStream.subscribeUserOrders(callback);
    } catch (error: unknown) {
      this.handleError(error, 'subscribeUserOrders');
      return '';
    }
  }

  /**
   * Subscribe to real-time user trade executions
   * Uses Gate.io's spot.usertrades channel for authenticated trade updates
   */
  async subscribeUserTrades(callback: (trade: Trade) => void): Promise<string> {
    try {
      if (!this.userDataStream) {
        throw new Error('User Data Stream not initialized. Call connectUserDataStream() first.');
      }
      return await this.userDataStream.subscribeUserTrades(callback);
    } catch (error: unknown) {
      this.handleError(error, 'subscribeUserTrades');
      return '';
    }
  }

  /**
   * Check if user data stream is connected
   */
  isUserDataStreamConnected(): boolean {
    return this.userDataStream ? this.userDataStream.isUserDataStreamConnected() : false;
  }

  // =============================================================================
  // Private Helper Methods
  // =============================================================================

  /**
   * Make public request to Gate.io API (no authentication required)
   */
  private async makePublicRequest(
    endpoint: string,
    params: Record<string, unknown> = {}
  ): Promise<unknown> {
    if (!this.auth) {
      throw new Error('Gate.io connector not authenticated');
    }
    return this.auth.makePublicRequest(endpoint, params);
  }
}
