import { BaseExchangeConnector } from '../../core/exchange/base-exchange-connector';
import { Order, OrderBook, Ticker, Trade, OrderType, OrderSide, Balance, ExchangeCredentials, WebSocketStatus } from '../../types';
import { BitgetAuth, BitgetCredentials } from './bitget-auth';
import { BitgetUtils } from './bitget-utils';
import { BitgetDataMapper } from './bitget-data-mapper';
import { BitgetWebSocket } from './bitget-websocket';
import { BitgetUserDataStream } from './bitget-user-stream';
import { createLogger, ExchangeUtils } from '../../utils';
import { toExchangeFormat } from '../../utils/symbol-utils';
import config from '../../config/environment';

/**
 * Bitget Exchange Connector
 * 
 * Implements the BaseExchangeConnector interface for Bitget exchange.
 * Provides trading operations, market data access, and WebSocket streaming.
 */
export class BitgetConnector extends BaseExchangeConnector {
  private auth?: BitgetAuth;
  private ws?: BitgetWebSocket;
  private userStream?: BitgetUserDataStream;
  private logger = createLogger('bitget-connector');
  private readonly baseUrl = 'https://api.bitget.com';
  private readonly dataMapper = new BitgetDataMapper();

  constructor() {
    super('bitget', 'Bitget');
    this.logger.info('BitgetConnector initialized');
    
    if (config.bitget) {
      this.setCredentials({
        apiKey: config.bitget.apiKey,
        secret: config.bitget.secret,
        passphrase: config.bitget.passphrase
      });
    }
  }

  /**
   * Set API credentials and initialize authentication handler
   * 
   * @param credentials - Bitget API credentials including apiKey, secret, and passphrase
   * @throws Error if credentials are missing required Bitget fields (passphrase)
   */
  setCredentials(credentials: ExchangeCredentials): void {
    super.setCredentials(credentials);
    
    if (!this.isValidBitgetCredentials(credentials)) {
      throw new Error('Invalid Bitget credentials: missing passphrase');
    }
    
    this.auth = new BitgetAuth(credentials as BitgetCredentials, this.baseUrl);
    this.logger.info('Bitget credentials set and authentication initialized');
  }

  /**
   * Connect to Bitget API by testing server time and validating credentials
   * 
   * @returns Promise that resolves when successfully connected to Bitget API
   * @throws Error if connection fails or credentials are invalid
   */
  async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to Bitget API...');
      
      const credentials = this.getCredentials();
      this.auth = new BitgetAuth(credentials as BitgetCredentials, this.baseUrl);

      const timeResponse = await this.auth.makePublicRequest('/api/v2/public/time');
      
      if (!timeResponse || !timeResponse.data) {
        throw new Error('Invalid response from Bitget time endpoint');
      }

      if (!this.auth.validateCredentialsExist()) {
        this.connected = false;
        this.handleError(new Error('Invalid Bitget credentials'), 'connect');
        return;
      }

      try {
        await this.auth.makeRequest('/api/v2/spot/account/assets');
      } catch (credError) {
        if (credError instanceof Error) {
          const errorMessage = BitgetUtils.mapErrorMessage(credError);
          throw new Error(`Credentials validation failed: ${errorMessage}`);
        }
      }

      this.connected = true;
      this.logger.info('Successfully connected to Bitget API', {
        serverTime: timeResponse.data.serverTime,
        localTime: Date.now()
      });
      
    } catch (error) {
      this.connected = false;
      this.handleError(error, 'connect');
    }
  }

  /**
   * Disconnect from Bitget API and clean up resources
   * 
   * @returns Promise that resolves when successfully disconnected from Bitget API
   */
  async disconnect(): Promise<void> {
    try {
      this.logger.info('Disconnecting from Bitget API...');
      
      // Disconnect WebSocket if connected
      await this.disconnectWebSocket();
      await this.disconnectUserDataStream();
      
      this.connected = false;
      this.auth = undefined;
      this.userStream = undefined;
      
      this.logger.info('Successfully disconnected from Bitget API');
      
    } catch (error) {
      this.handleError(error, 'disconnect');
    }
  }

  /**
   * Validate if credentials contain required Bitget fields
   */
  private isValidBitgetCredentials(credentials: ExchangeCredentials): credentials is BitgetCredentials {
    return !!(credentials as BitgetCredentials).passphrase;
  }

  /**
   * Get account balance for all assets or a specific asset
   * 
   * @returns Promise resolving to balance data - either all balances or single asset balance
   * @throws Error if API request fails or credentials are invalid
   */
  async getBalance(): Promise<Record<string, Balance>>;
  async getBalance(asset: string): Promise<Balance>;
  async getBalance(asset?: string): Promise<Record<string, Balance> | Balance> {
    try {
      const assetsData = await this.makeRequest('/api/v2/spot/account/assets');
      
      if (!assetsData || !assetsData.data) {
        throw new Error('Invalid response from Bitget assets endpoint');
      }

      const balances: Record<string, Balance> = {};
      
      for (const assetInfo of assetsData.data) {
        const available = parseFloat(assetInfo.available || '0');
        const frozen = parseFloat(assetInfo.frozen || '0');
        const total = available + frozen;

        balances[assetInfo.coin] = {
          asset: assetInfo.coin,
          free: available,
          used: frozen,
          total: total,
          available: available
        };
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
      const errorMessage = BitgetUtils.mapErrorMessage(error);
      this.handleError(new Error(errorMessage), 'getBalance');
    }
  }

  /**
   * Create a new order on Bitget exchange
   * 
   * @param symbol - Trading pair symbol (e.g., 'SNEK/USDT')
   * @param type - Order type ('market' or 'limit')
   * @param side - Order side ('buy' or 'sell')
   * @param amount - Order quantity/amount
   * @param price - Optional. Price for limit orders (required for limit orders)
   * @returns Promise resolving to the created order details
   * @throws Error if order creation fails or parameters are invalid
   */
  async createOrder(symbol: string, type: OrderType, side: OrderSide, amount: number, price?: number): Promise<Order> {
    try {
      if (!ExchangeUtils.isValidSymbol(symbol)) {
        throw new Error(`Invalid symbol format: ${symbol}`);
      }

      const orderParams = ExchangeUtils.createBitgetOrderParams(symbol, type, side, amount, price);

      const response = await this.makeRequest(
        '/api/v2/spot/trade/place-order',
        {},
        'POST',
        orderParams
      );

      if (!response || !response.data) {
        throw new Error('Invalid response from Bitget place-order endpoint');
      }

      const orderData = {
        orderId: response.data.orderId,
        clientOid: response.data.clientOid,
        symbol: toExchangeFormat(symbol),
        side: side.toLowerCase(),
        orderType: type.toLowerCase(),
        force: 'gtc',
        price: price?.toString(),
        size: amount.toString(),
        filledQty: '0',
        state: 'NEW',
        cTime: Date.now()
      };

      return this.dataMapper.mapOrder(orderData);
    } catch (error: unknown) {
      const errorMessage = BitgetUtils.mapErrorMessage(error);
      this.handleError(new Error(errorMessage), 'createOrder');
    }
  }

  /**
   * Cancel an existing order on Bitget exchange
   * 
   * @param orderId - The ID of the order to cancel
   * @param symbol - Trading pair symbol (e.g., 'SNEK/USDT')
   * @returns Promise that resolves when order is successfully cancelled
   * @throws Error if cancellation fails or order not found
   */
  async cancelOrder(orderId: string, symbol: string): Promise<void> {
    try {
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      if (!ExchangeUtils.isValidSymbol(symbol)) {
        throw new Error(`Invalid symbol format: ${symbol}`);
      }

      const bitgetSymbol = toExchangeFormat(symbol);
      
      const response = await this.makeRequest(
        '/api/v2/spot/trade/cancel-order',
        {},
        'POST',
        {
          symbol: bitgetSymbol,
          orderId: orderId
        }
      );

      if (!response || response.code !== '00000') {
        throw new Error('Failed to cancel order');
      }

      this.logger.info('Order cancelled successfully', {
        orderId,
        symbol: bitgetSymbol
      });
    } catch (error: unknown) {
      const errorMessage = BitgetUtils.mapErrorMessage(error);
      this.handleError(new Error(errorMessage), 'cancelOrder');
    }
  }

  /**
   * Cancel all open orders for a specific symbol
   * 
   * @param symbol - Trading pair symbol (e.g., 'SNEK/USDT')
   * @returns Promise that resolves when all orders are cancelled
   * @throws Error if cancellation fails
   */
  async cancelAllOrders(symbol: string): Promise<void> {
    try {
      if (!ExchangeUtils.isValidSymbol(symbol)) {
        throw new Error(`Invalid symbol format: ${symbol}`);
      }

      const bitgetSymbol = toExchangeFormat(symbol);
      
      try {
        const response = await this.makeRequest(
          '/api/v2/spot/trade/cancel-symbol-order',
          {},
          'POST',
          {
            symbol: bitgetSymbol
          }
        );

        if (response && response.code === '00000') {
          this.logger.info('All orders cancelled successfully via bulk operation', {
            symbol: bitgetSymbol
          });
          return;
        }
      } catch (bulkError) {
        this.logger.warn('Bulk cancellation failed, falling back to individual cancellation', {
          symbol: bitgetSymbol,
          error: bulkError instanceof Error ? bulkError.message : String(bulkError)
        });
      }

      const openOrders = await this.getOpenOrders(symbol);
      
      if (openOrders.length === 0) {
        this.logger.info('No open orders to cancel', { symbol: bitgetSymbol });
        return;
      }

      const cancelPromises = openOrders.map(order => 
        this.cancelOrder(order.id, symbol).catch(error => {
          this.logger.error(`Failed to cancel order ${order.id}`, { error: error instanceof Error ? error.message : String(error) });
          throw error;
        })
      );

      await Promise.all(cancelPromises);
      
      this.logger.info(`Successfully cancelled ${openOrders.length} orders`, {
        symbol: bitgetSymbol,
        orderCount: openOrders.length
      });
      
    } catch (error: unknown) {
      const errorMessage = BitgetUtils.mapErrorMessage(error);
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
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      if (!ExchangeUtils.isValidSymbol(symbol)) {
        throw new Error(`Invalid symbol format: ${symbol}`);
      }

      const bitgetSymbol = toExchangeFormat(symbol);
      
      const response = await this.makeRequest(
        '/api/v2/spot/trade/orderInfo',
        {
          symbol: bitgetSymbol,
          orderId: orderId
        }
      );

      if (!response || !response.data) {
        throw new Error('Order not found');
      }

      return this.dataMapper.mapOrder(response.data);
    } catch (error: unknown) {
      const errorMessage = BitgetUtils.mapErrorMessage(error);
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
      const params: Record<string, unknown> = {};
      
      if (symbol) {
        if (!BitgetUtils.isValidSymbol(symbol)) {
          throw new Error(`Invalid symbol format: ${symbol}`);
        }
        params.symbol = toExchangeFormat(symbol);
      }

      const response = await this.makeRequest('/api/v2/spot/trade/unfilled-orders', params);

      if (!response || !Array.isArray(response.data)) {
        return [];
      }

      return response.data.map((orderData: any) => this.dataMapper.mapOrder(orderData));
    } catch (error: unknown) {
      const errorMessage = BitgetUtils.mapErrorMessage(error);
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
      if (!ExchangeUtils.isValidSymbol(symbol)) {
        throw new Error(`Invalid symbol format: ${symbol}`);
      }

      const bitgetSymbol = toExchangeFormat(symbol);
      
      const response = await this.makePublicRequest('/api/v2/spot/market/tickers', {
        symbol: bitgetSymbol
      });

      if (!response || !response.data || !Array.isArray(response.data) || response.data.length === 0) {
        throw new Error('No ticker data found');
      }

      return this.dataMapper.mapTicker(response.data[0]);
    } catch (error: unknown) {
      const errorMessage = BitgetUtils.mapErrorMessage(error);
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
      if (!ExchangeUtils.isValidSymbol(symbol)) {
        throw new Error(`Invalid symbol format: ${symbol}`);
      }

      const bitgetSymbol = toExchangeFormat(symbol);
      
      const response = await this.makePublicRequest('/api/v2/spot/market/orderbook', {
        symbol: bitgetSymbol,
        type: 'step0',
        limit: '100'
      });

      if (!response || !response.data) {
        throw new Error('No orderbook data found');
      }

      return this.dataMapper.mapOrderBook(response.data, symbol);
    } catch (error: unknown) {
      const errorMessage = BitgetUtils.mapErrorMessage(error);
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
      if (!ExchangeUtils.isValidSymbol(symbol)) {
        throw new Error(`Invalid symbol format: ${symbol}`);
      }

      const bitgetSymbol = toExchangeFormat(symbol);
      
      const response = await this.makePublicRequest('/api/v2/spot/market/fills', {
        symbol: bitgetSymbol,
        limit: '100'
      });

      if (!response || !Array.isArray(response.data)) {
        return [];
      }

      return response.data.map((tradeData: any) => this.dataMapper.mapTrade(tradeData, symbol));
    } catch (error: unknown) {
      const errorMessage = BitgetUtils.mapErrorMessage(error);
      this.handleError(new Error(errorMessage), 'getRecentTrades');
    }
  }

  // WebSocket Methods Implementation

  /**
   * Connect to Bitget WebSocket for real-time data
   * 
   * @returns Promise that resolves when WebSocket connection is established
   * @throws Error if connection fails
   */
  async connectWebSocket(): Promise<void> {
    try {
      if (!this.ws) {
        this.ws = new BitgetWebSocket();
      }
      await this.ws.connectWebSocket();
      this.logger.info('Successfully connected to Bitget WebSocket');
    } catch (error: unknown) {
      this.handleError(error, 'connectWebSocket');
    }
  }

  /**
   * Disconnect from Bitget WebSocket
   * 
   * @returns Promise that resolves when WebSocket is disconnected
   */
  async disconnectWebSocket(): Promise<void> {
    try {
      if (this.ws) {
        await this.ws.disconnectWebSocket();
        this.ws = undefined;
        this.logger.info('Successfully disconnected from Bitget WebSocket');
      }
    } catch (error: unknown) {
      this.handleError(error, 'disconnectWebSocket');
    }
  }

  /**
   * Subscribe to real-time ticker updates for a trading pair
   * 
   * @param symbol - Trading pair symbol (e.g., 'SNEK/USDT')
   * @param callback - Function called when ticker updates are received
   * @returns Promise resolving to subscription ID for managing the subscription
   * @throws Error if WebSocket not connected or subscription fails
   */
  async subscribeTicker(symbol: string, callback: (ticker: Ticker) => void): Promise<string> {
    try {
      if (!this.ws) {
        throw new Error('WebSocket not initialized. Call connectWebSocket() first.');
      }
      return await this.ws.subscribeTicker(symbol, callback);
    } catch (error: unknown) {
      this.handleError(error, 'subscribeTicker');
      return '';
    }
  }

  /**
   * Subscribe to real-time order book updates for a trading pair
   * 
   * @param symbol - Trading pair symbol (e.g., 'SNEK/USDT')
   * @param callback - Function called when order book updates are received
   * @returns Promise resolving to subscription ID for managing the subscription
   * @throws Error if WebSocket not connected or subscription fails
   */
  async subscribeOrderBook(symbol: string, callback: (orderbook: OrderBook) => void): Promise<string> {
    try {
      if (!this.ws) {
        throw new Error('WebSocket not initialized. Call connectWebSocket() first.');
      }
      return await this.ws.subscribeOrderBook(symbol, callback);
    } catch (error: unknown) {
      this.handleError(error, 'subscribeOrderBook');
      return '';
    }
  }

  /**
   * Subscribe to real-time trade updates for a trading pair
   * 
   * @param symbol - Trading pair symbol (e.g., 'SNEK/USDT')
   * @param callback - Function called when new trades are executed
   * @returns Promise resolving to subscription ID for managing the subscription
   * @throws Error if WebSocket not connected or subscription fails
   */
  async subscribeTrades(symbol: string, callback: (trade: Trade) => void): Promise<string> {
    try {
      if (!this.ws) {
        throw new Error('WebSocket not initialized. Call connectWebSocket() first.');
      }
      return await this.ws.subscribeTrades(symbol, callback);
    } catch (error: unknown) {
      this.handleError(error, 'subscribeTrades');
      return '';
    }
  }

  /**
   * Subscribe to real-time order updates (user data)
   * 
   * @param callback - Function called when user's order status changes
   * @returns Promise resolving to subscription ID for managing the subscription
   * @throws Error if WebSocket not connected or subscription fails
   */
  async subscribeOrders(callback: (order: Order) => void): Promise<string> {
    try {
      if (!this.userStream) {
        throw new Error('User Data Stream not initialized. Call connectUserDataStream() first.');
      }
      return await this.userStream.subscribeUserOrders(callback);
    } catch (error: unknown) {
      this.handleError(error, 'subscribeOrders');
      return '';
    }
  }

  /**
   * Unsubscribe from a WebSocket subscription
   * 
   * @param subscriptionId - The ID of the subscription to cancel
   * @returns Promise that resolves when subscription is cancelled
   * @throws Error if WebSocket not connected or unsubscribe fails
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    try {
      if (!this.ws) {
        throw new Error('WebSocket not initialized.');
      }
      await this.ws.unsubscribe(subscriptionId);
    } catch (error: unknown) {
      this.handleError(error, 'unsubscribe');
    }
  }

  /**
   * Check if WebSocket connection is active
   * 
   * @returns Boolean indicating WebSocket connection status
   */
  isWebSocketConnected(): boolean {
    return this.ws ? this.ws.isConnected() : false;
  }

  /**
   * Get current WebSocket connection status
   * 
   * @returns Current WebSocket status ('connected', 'disconnected', etc.)
   */
  getWebSocketStatus(): WebSocketStatus {
    return this.ws ? this.ws.getWebSocketStatus() : 'disconnected';
  }

  /**
   * User Data Stream Methods Implementation
   */

  /**
   * Connect to user data stream for real-time account updates
   * 
   * @returns Promise that resolves when user data stream is connected
   * @throws Error if authentication fails or connection cannot be established
   */
  async connectUserDataStream(): Promise<void> {
    try {
      if (!this.auth) {
        throw new Error('Authentication required. Call connect() first.');
      }
      
      if (!this.userStream) {
        this.userStream = new BitgetUserDataStream(this.auth);
      }
      
      await this.userStream.connectUserDataStream();
      this.logger.info('Successfully connected to Bitget User Data Stream');
    } catch (error: unknown) {
      this.handleError(error, 'connectUserDataStream');
    }
  }

  /**
   * Disconnect from user data stream
   * 
   * @returns Promise that resolves when user data stream is disconnected
   */
  async disconnectUserDataStream(): Promise<void> {
    try {
      if (this.userStream) {
        await this.userStream.disconnectUserDataStream();
        this.userStream = undefined;
        this.logger.info('Successfully disconnected from Bitget User Data Stream');
      }
    } catch (error: unknown) {
      this.handleError(error, 'disconnectUserDataStream');
    }
  }

  /**
   * Subscribe to real-time user order updates (limit/market orders)
   * 
   * @param callback - Function called when user's orders change status
   * @returns Promise resolving to subscription ID for managing the subscription
   * @throws Error if user data stream not connected or subscription fails
   */
  async subscribeUserOrders(callback: (order: Order) => void): Promise<string> {
    try {
      if (!this.userStream) {
        throw new Error('User Data Stream not initialized. Call connectUserDataStream() first.');
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
   * 
   * @param callback - Function called when user's trades are executed
   * @returns Promise resolving to subscription ID for managing the subscription
   * @throws Error if user data stream not connected or subscription fails
   */
  async subscribeUserTrades(callback: (trade: Trade) => void): Promise<string> {
    try {
      if (!this.userStream) {
        throw new Error('User Data Stream not initialized. Call connectUserDataStream() first.');
      }
      return await this.userStream.subscribeUserTrades(callback);
    } catch (error: unknown) {
      this.handleError(error, 'subscribeUserTrades');
      return '';
    }
  }

  /**
   * Subscribe to real-time account balance updates
   * 
   * @param callback - Function called when account balance changes
   * @returns Promise resolving to subscription ID for managing the subscription
   * @throws Error if user data stream not connected or subscription fails
   */
  async subscribeAccountUpdates(callback: (accountData: any) => void): Promise<string> {
    try {
      if (!this.userStream) {
        throw new Error('User Data Stream not initialized. Call connectUserDataStream() first.');
      }
      return await this.userStream.subscribeAccountUpdates(callback);
    } catch (error: unknown) {
      this.handleError(error, 'subscribeAccountUpdates');
      return '';
    }
  }

  /**
   * Check if user data stream is connected
   * 
   * @returns Boolean indicating user data stream connection status
   */
  isUserDataStreamConnected(): boolean {
    return this.userStream ? this.userStream.isUserDataStreamConnected() : false;
  }

  /**
   * Make authenticated request to Bitget API
   * 
   * @param endpoint - API endpoint path
   * @param params - Query parameters for the request
   * @param method - HTTP method ('GET', 'POST', 'PUT', 'DELETE')
   * @param body - Request body data for POST/PUT requests
   * @returns Promise resolving to API response data
   * @throws Error if not authenticated or request fails
   */
  private async makeRequest(
    endpoint: string,
    params: Record<string, unknown> = {},
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: Record<string, unknown>
  ): Promise<any> {
    if (!this.auth) {
      throw new Error('Bitget connector not authenticated');
    }
    return this.auth.makeRequest(endpoint, params, method, body);
  }

  /**
   * Make public request to Bitget API (no authentication required)
   * 
   * @param endpoint - API endpoint path
   * @param params - Query parameters for the request
   * @returns Promise resolving to API response data
   * @throws Error if request fails
   */
  private async makePublicRequest(endpoint: string, params: Record<string, unknown> = {}): Promise<any> {
    if (!this.auth) {
      throw new Error('Bitget connector not authenticated');
    }
    return this.auth.makePublicRequest(endpoint, params);
  }
}