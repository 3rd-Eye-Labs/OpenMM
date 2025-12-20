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
import { createLogger, ExchangeUtils } from '../../utils';

/**
 * Gate.io Exchange Connector
 *
 * Implements the BaseExchangeConnector interface for Gate.io exchange.
 * Provides trading operations, market data access, and WebSocket streaming.
 */
export class GateioConnector extends BaseExchangeConnector {
  private auth?: GateioAuth;
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
    this.logger.info('Gate.io credentials set and authentication initialized');
  }

  /**
   * Connect to Gate.io API by testing server time and validating credentials
   *
   * @returns Promise that resolves when successfully connected to Gate.io API
   * @throws Error if connection fails or credentials are invalid
   */
  async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to Gate.io API...');

      const credentials = this.getCredentials();
      this.auth = new GateioAuth(credentials, this.baseUrl);

      // Test public endpoint first
      const timeResponse = await this.auth.makePublicRequest('/spot/time');

      if (!timeResponse || !timeResponse.server_time) {
        throw new Error('Invalid response from Gate.io time endpoint');
      }

      const serverTime = GateioUtils.parseTimestamp(timeResponse.server_time);
      const localTime = Date.now();

      // Validate credentials with authenticated request
      if (!this.auth.validateCredentialsExist()) {
        this.connected = false;
        this.handleError(new Error('Invalid Gate.io credentials'), 'connect');
        return;
      }

      try {
        // Test with a simple authenticated endpoint
        await this.auth.makeRequest('/spot/accounts');
      } catch (credError) {
        if (credError instanceof Error) {
          const errorMessage = GateioUtils.mapErrorMessage(credError);
          throw new Error(`Credentials validation failed: ${errorMessage}`);
        }
      }

      this.connected = true;
      this.logger.info('Successfully connected to Gate.io API', {
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
      this.logger.info('Disconnecting from Gate.io API...');

      // Disconnect WebSocket if connected (Phase 2)
      await this.disconnectWebSocket();
      await this.disconnectUserDataStream();

      this.connected = false;
      this.auth = undefined;

      this.logger.info('Successfully disconnected from Gate.io API');
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

      this.logger.debug('Fetching account balances from Gate.io');

      const response = await this.auth.makeRequest('/spot/accounts');

      if (!Array.isArray(response)) {
        throw new Error('Invalid response from Gate.io accounts endpoint - expected array');
      }

      this.logger.debug(`Retrieved ${response.length} account balances`);

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

      // Use ExchangeUtils to create order parameters with validation
      const orderRequest = ExchangeUtils.createGateioOrderParams(symbol, type, side, amount, price);

      this.logger.debug('Creating order on Gate.io', {
        symbol,
        currencyPair: orderRequest.currency_pair,
        type,
        side,
        amount,
        price,
      });

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

      const response = await this.auth.makeRequest(
        '/spot/orders',
        { currency_pair: currencyPair },
        'DELETE'
      );

      const cancelledOrders = Array.isArray(response) ? response : [];

      if (cancelledOrders.length > 0) {
        this.logger.debug('Cancelled order IDs', {
          orderIds: cancelledOrders.map((order: any) => order.id),
        });
      }
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

      this.logger.debug('Fetching order details from Gate.io', {
        orderId,
        symbol,
        currencyPair,
      });

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

      this.logger.debug('Fetching open orders from Gate.io', {
        symbol,
        currencyPair: params.currency_pair,
      });

      const response = await this.auth.makeRequest('/spot/open_orders', params);

      if (!Array.isArray(response)) {
        this.logger.warn('Gate.io open orders returned unexpected format', { response });
        return [];
      }

      const allOrders = GateioUtils.extractOrdersFromOpenOrdersResponse(response);

      this.logger.debug(`Retrieved ${allOrders.length} open orders`);

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

      this.logger.debug('Fetching ticker from Gate.io', {
        symbol,
        currencyPair,
      });

      const response = await this.makePublicRequest('/spot/tickers', {
        currency_pair: currencyPair,
      });

      if (!Array.isArray(response) || response.length === 0) {
        throw new Error('No ticker data found');
      }

      this.logger.debug('Ticker data retrieved successfully', {
        symbol: currencyPair,
        last: response[0].last,
      });

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

      this.logger.debug('Fetching order book from Gate.io', {
        symbol,
        currencyPair,
      });

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

      this.logger.debug(`Retrieved ${response.length} recent trades`, {
        symbol: currencyPair,
      });

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
  // WebSocket Methods (Placeholder implementations - TODO)
  // =============================================================================

  /**
   * Connect to Gate.io WebSocket for real-time data
   * @throws Error - Not implemented yet
   */
  async connectWebSocket(): Promise<void> {
    throw new Error('Gate.io WebSocket not implemented yet');
  }

  /**
   * Disconnect from Gate.io WebSocket
   * @throws Error - Not implemented yet
   */
  async disconnectWebSocket(): Promise<void> {
    // No-op for now since WebSocket not implemented
  }

  /**
   * Subscribe to real-time ticker updates for a trading pair
   * @throws Error - Not implemented yet
   */
  async subscribeTicker(symbol: string, callback: (ticker: Ticker) => void): Promise<string> {
    throw new Error('Gate.io subscribeTicker not implemented yet');
  }

  /**
   * Subscribe to real-time order book updates for a trading pair
   * @throws Error - Not implemented yet
   */
  async subscribeOrderBook(
    symbol: string,
    callback: (orderbook: OrderBook) => void
  ): Promise<string> {
    throw new Error('Gate.io subscribeOrderBook not implemented yet');
  }

  /**
   * Subscribe to real-time trade updates for a trading pair
   * @throws Error - Not implemented yet
   */
  async subscribeTrades(symbol: string, callback: (trade: Trade) => void): Promise<string> {
    throw new Error('Gate.io subscribeTrades not implemented yet');
  }

  /**
   * Subscribe to real-time order updates (user data)
   * @throws Error - Not implemented yet
   */
  async subscribeOrders(callback: (order: Order) => void): Promise<string> {
    throw new Error('Gate.io subscribeOrders not implemented yet');
  }

  /**
   * Unsubscribe from a WebSocket subscription
   * @throws Error - Not implemented yet
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    throw new Error('Gate.io unsubscribe not implemented yet');
  }

  /**
   * Check if WebSocket connection is active
   */
  isWebSocketConnected(): boolean {
    return false;
  }

  /**
   * Get current WebSocket connection status
   */
  getWebSocketStatus(): WebSocketStatus {
    return 'disconnected'; // Phase 2 implementation
  }

  // =============================================================================
  // User Data Stream Methods (Placeholder implementations TODO)
  // =============================================================================

  /**
   * Connect to user data stream for real-time account updates
   * @throws Error - Not implemented yet
   */
  async connectUserDataStream(): Promise<void> {
    throw new Error('Gate.io User Data Stream not implemented yet');
  }

  /**
   * Disconnect from user data stream
   * @throws Error - Not implemented yet
   */
  async disconnectUserDataStream(): Promise<void> {
    // No-op for now since User Data Stream not implemented
  }

  /**
   * Subscribe to real-time user order updates
   * @throws Error - Not implemented yet
   */
  async subscribeUserOrders(callback: (order: Order) => void): Promise<string> {
    throw new Error('Gate.io subscribeUserOrders not implemented yet');
  }

  /**
   * Subscribe to real-time user trade executions
   * @throws Error - Not implemented yet
   */
  async subscribeUserTrades(callback: (trade: Trade) => void): Promise<string> {
    throw new Error('Gate.io subscribeUserTrades not implemented yet');
  }

  /**
   * Check if user data stream is connected
   */
  isUserDataStreamConnected(): boolean {
    return false; // Phase 2 implementation
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
