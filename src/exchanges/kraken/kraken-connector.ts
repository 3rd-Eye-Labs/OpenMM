import { BaseExchangeConnector } from '../../core/exchange/base-exchange-connector';
import {
  Order,
  OrderBook,
  Ticker,
  Trade,
  OrderType,
  OrderSide,
  Balance,
  WebSocketStatus,
} from '../../types';
import { KrakenAuth } from './kraken-auth';
import { KrakenDataMapper } from './kraken-data-mapper';
import { KrakenUtils } from './kraken-utils';
import { KrakenWebSocket } from './kraken-websocket';
import { createLogger } from '../../utils';
import { ExchangeUtils } from '../../utils';
import config from '../../config/environment';

export class KrakenConnector extends BaseExchangeConnector {
  private auth?: KrakenAuth;
  private webSocket?: KrakenWebSocket;
  private readonly baseUrl: string;
  private readonly dataMapper = new KrakenDataMapper();
  private logger = createLogger('kraken-connector');
  private userOrderSubscriptionId?: string;
  private userTradeSubscriptionId?: string;

  constructor() {
    super('kraken', 'Kraken');
    this.baseUrl = 'https://api.kraken.com';

    this.setCredentials({
      apiKey: config.kraken?.apiKey || '',
      secret: config.kraken?.secret || '',
    });
  }

  async connect(): Promise<void> {
    try {
      const credentials = this.getCredentials();
      this.auth = new KrakenAuth(credentials);
      this.connected = true;
      this.logger.info('Connected to Kraken REST API');
    } catch (error) {
      this.handleError(error, 'connect');
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.logger.info('Disconnected from Kraken REST API');
  }

  async getBalance(): Promise<Record<string, Balance>> {
    if (!this.auth) throw new Error('Not authenticated');

    try {
      const result = await this.auth.makeRequest(
        `${this.baseUrl}/0/private/Balance`,
        '/0/private/Balance'
      );
      return this.dataMapper.mapBalance(result as Record<string, string>);
    } catch (error) {
      this.handleError(error, 'getBalance');
    }
  }

  async createOrder(
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price?: number
  ): Promise<Order> {
    if (!this.auth) throw new Error('Not authenticated');

    try {
      const params = ExchangeUtils.createKrakenOrderParams(symbol, type, side, amount, price);

      const result = await this.auth.makeRequest(
        `${this.baseUrl}/0/private/AddOrder`,
        '/0/private/AddOrder',
        params
      );

      const orderInfo = result as Record<string, unknown>;
      const orderIds = orderInfo.txid as string[];

      if (!orderIds || orderIds.length === 0) {
        throw new Error('No order ID returned from Kraken');
      }

      // Wait a moment for the order to be available in the system
      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        return await this.getOrder(orderIds[0], symbol);
      } catch (error) {
        return {
          id: orderIds[0],
          symbol,
          type,
          side,
          price: price || 0,
          amount,
          filled: 0,
          remaining: amount,
          status: 'open',
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      this.handleError(error, 'createOrder');
    }
  }

  async cancelOrder(orderId: string, symbol?: string): Promise<void> {
    if (!this.auth) throw new Error('Not authenticated');

    try {
      await this.auth.makeRequest(
        `${this.baseUrl}/0/private/CancelOrder`,
        '/0/private/CancelOrder',
        { txid: orderId }
      );
      this.logger.info(`Order ${orderId} canceled`);
    } catch (error) {
      this.handleError(error, 'cancelOrder');
    }
  }

  async cancelAllOrders(symbol?: string): Promise<void> {
    if (!this.auth) throw new Error('Not authenticated');

    try {
      const params: Record<string, unknown> = {};

      if (symbol) {
        params.pair = KrakenUtils.toKrakenSymbol(symbol);
      }

      await this.auth.makeRequest(
        `${this.baseUrl}/0/private/CancelAll`,
        '/0/private/CancelAll',
        params
      );

      this.logger.info(symbol ? `All orders for ${symbol} canceled` : 'All orders canceled');
    } catch (error) {
      this.handleError(error, 'cancelAllOrders');
    }
  }

  async getOrder(orderId: string, symbol?: string): Promise<Order> {
    if (!this.auth) throw new Error('Not authenticated');

    try {
      const result = await this.auth.makeRequest(
        `${this.baseUrl}/0/private/QueryOrders`,
        '/0/private/QueryOrders',
        { txid: orderId }
      );

      const orders = result as Record<string, unknown>;
      const order = orders[orderId] as Record<string, unknown>;

      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      const mapped = this.dataMapper.mapOrder({ ...order, txid: orderId });
      if (symbol) {
        mapped.symbol = symbol;
      } else {
        const descr = order.descr as Record<string, string>;
        mapped.symbol = KrakenUtils.fromKrakenSymbol(descr.pair);
      }
      return mapped;
    } catch (error) {
      this.handleError(error, 'getOrder');
    }
  }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    if (!this.auth) throw new Error('Not authenticated');

    try {
      const result = await this.auth.makeRequest(
        `${this.baseUrl}/0/private/OpenOrders`,
        '/0/private/OpenOrders'
      );

      // Kraken returns { open: { ...orders } } structure
      const response = result as { open?: Record<string, Record<string, unknown>> };
      const openOrders = response.open || response;

      if (!openOrders || typeof openOrders !== 'object' || Object.keys(openOrders).length === 0) {
        return [];
      }

      const mappedOrders = Object.entries(openOrders)
        .filter(([, order]) => order && typeof order === 'object')
        .map(([txid, order]) => {
          const mapped = this.dataMapper.mapOrder({ ...order, txid });
          const descr = order.descr as Record<string, string>;
          if (descr && descr.pair) {
            mapped.symbol = KrakenUtils.fromKrakenSymbol(descr.pair);
          }
          return mapped;
        });

      if (symbol) {
        return mappedOrders.filter(order => order.symbol === symbol);
      }

      return mappedOrders;
    } catch (error) {
      this.handleError(error, 'getOpenOrders');
    }
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const krakenSymbol = KrakenUtils.toKrakenSymbol(symbol);

    try {
      const response = await fetch(`${this.baseUrl}/0/public/Ticker?pair=${krakenSymbol}`);
      const data = await response.json();

      if (data.error && data.error.length > 0) {
        throw new Error(KrakenUtils.mapErrorMessage(data.error));
      }

      const tickerData = Object.values(data.result)[0] as Record<string, unknown>;
      const ticker = this.dataMapper.mapTicker(tickerData);
      ticker.symbol = symbol;
      return ticker;
    } catch (error) {
      this.handleError(error, 'getTicker');
    }
  }

  async getOrderBook(symbol: string): Promise<OrderBook> {
    const krakenSymbol = KrakenUtils.toKrakenSymbol(symbol);

    try {
      const response = await fetch(`${this.baseUrl}/0/public/Depth?pair=${krakenSymbol}&count=100`);
      const data = await response.json();

      if (data.error && data.error.length > 0) {
        throw new Error(KrakenUtils.mapErrorMessage(data.error));
      }

      const bookData = Object.values(data.result)[0] as Record<string, unknown>;
      const orderBook = this.dataMapper.mapOrderBook(bookData);
      orderBook.symbol = symbol;
      return orderBook;
    } catch (error) {
      this.handleError(error, 'getOrderBook');
    }
  }

  async getRecentTrades(symbol: string, count: number = 1000): Promise<Trade[]> {
    const krakenSymbol = KrakenUtils.toKrakenSymbol(symbol);

    try {
      const response = await fetch(
        `${this.baseUrl}/0/public/Trades?pair=${krakenSymbol}&count=${count}`
      );
      const data = await response.json();

      if (data.error && data.error.length > 0) {
        throw new Error(KrakenUtils.mapErrorMessage(data.error));
      }

      const tradesData = Object.values(data.result)[0] as Array<
        [string, string, number, string, string, string]
      >;
      const trades = this.dataMapper.mapTrades(tradesData);
      trades.forEach(trade => (trade.symbol = symbol));
      return trades;
    } catch (error) {
      this.handleError(error, 'getRecentTrades');
    }
  }

  async connectWebSocket(): Promise<void> {
    try {
      if (this.webSocket?.isConnected()) {
        return;
      }

      if (!this.webSocket) {
        this.webSocket = new KrakenWebSocket();
        const credentials = this.getCredentials();
        if (credentials.apiKey && credentials.secret) {
          this.webSocket.setCredentials(credentials.apiKey, credentials.secret);
        }
      }

      await this.webSocket.connectWebSocket();
      this.logger.info('Connected to Kraken WebSocket');
    } catch (error) {
      this.handleError(error, 'connectWebSocket');
    }
  }

  async disconnectWebSocket(): Promise<void> {
    try {
      if (!this.webSocket) {
        return;
      }

      await this.webSocket.disconnectWebSocket();
      this.webSocket = undefined;
      this.logger.info('Disconnected from Kraken WebSocket');
    } catch (error) {
      this.handleError(error, 'disconnectWebSocket');
    }
  }

  async subscribeTicker(symbol: string, callback: (ticker: Ticker) => void): Promise<string> {
    if (!this.webSocket || !this.webSocket.isConnected()) {
      await this.connectWebSocket();
    }

    return this.webSocket!.subscribeTicker(symbol, callback);
  }

  async subscribeOrderBook(
    symbol: string,
    callback: (orderbook: OrderBook) => void
  ): Promise<string> {
    if (!this.webSocket || !this.webSocket.isConnected()) {
      await this.connectWebSocket();
    }

    return this.webSocket!.subscribeOrderBook(symbol, callback);
  }

  async subscribeTrades(symbol: string, callback: (trade: Trade) => void): Promise<string> {
    if (!this.webSocket || !this.webSocket.isConnected()) {
      await this.connectWebSocket();
    }

    return this.webSocket!.subscribeTrades(symbol, callback);
  }

  async subscribeOrders(callback: (order: Order) => void): Promise<string> {
    throw new Error('Orders subscription requires user data stream - use subscribeUserOrders');
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    if (!this.webSocket) {
      throw new Error('WebSocket not connected');
    }

    await this.webSocket.unsubscribe(subscriptionId);
  }

  isWebSocketConnected(): boolean {
    return this.webSocket?.isConnected() || false;
  }

  getWebSocketStatus(): WebSocketStatus {
    return this.webSocket?.getStatus() || 'disconnected';
  }

  async connectUserDataStream(): Promise<void> {
    try {
      if (this.webSocket?.isPrivateConnected()) {
        return;
      }

      if (!this.webSocket) {
        this.webSocket = new KrakenWebSocket();
        const credentials = this.getCredentials();
        this.webSocket.setCredentials(credentials.apiKey, credentials.secret);
      }

      await this.webSocket.connectPrivateWebSocket();
      this.logger.info('Connected to Kraken private WebSocket');
    } catch (error) {
      this.handleError(error, 'connectUserDataStream');
    }
  }

  async disconnectUserDataStream(): Promise<void> {
    try {
      if (!this.webSocket) {
        return;
      }

      if (this.userOrderSubscriptionId) {
        await this.webSocket.unsubscribe(this.userOrderSubscriptionId);
        this.userOrderSubscriptionId = undefined;
      }

      if (this.userTradeSubscriptionId) {
        await this.webSocket.unsubscribe(this.userTradeSubscriptionId);
        this.userTradeSubscriptionId = undefined;
      }

      await this.webSocket.disconnectPrivateWebSocket();
      this.logger.info('Disconnected from Kraken private WebSocket');
    } catch (error) {
      this.handleError(error, 'disconnectUserDataStream');
    }
  }

  async subscribeUserOrders(callback: (order: Order) => void): Promise<string> {
    if (!this.webSocket || !this.webSocket.isPrivateConnected()) {
      await this.connectUserDataStream();
    }

    this.userOrderSubscriptionId = await this.webSocket!.subscribeUserOrders(callback);
    return this.userOrderSubscriptionId;
  }

  async subscribeUserTrades(callback: (trade: Trade) => void): Promise<string> {
    if (!this.webSocket || !this.webSocket.isPrivateConnected()) {
      await this.connectUserDataStream();
    }

    this.userTradeSubscriptionId = await this.webSocket!.subscribeUserTrades(callback);
    return this.userTradeSubscriptionId;
  }

  isUserDataStreamConnected(): boolean {
    return this.webSocket?.isPrivateConnected() || false;
  }
}
