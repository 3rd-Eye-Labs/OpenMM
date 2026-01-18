import WebSocket from 'ws';
import {
  OrderBook,
  Ticker,
  Trade,
  WebSocketStatus,
  Order,
  KrakenSubscriptionInfo,
  KrakenWebSocketMessage,
  KrakenRawTickerData,
  KrakenRawOrderBookData,
  KrakenRawTradeData,
} from '../../types';
import { KrakenDataMapper } from './kraken-data-mapper';
import { KrakenUtils } from './kraken-utils';
import { KrakenAuth } from './kraken-auth';
import { createLogger } from '../../utils';

export class KrakenWebSocket {
  private ws?: WebSocket;
  private privateWs?: WebSocket;
  private subscriptions = new Map<string, KrakenSubscriptionInfo>();
  private status: WebSocketStatus = 'disconnected';
  private privateStatus: WebSocketStatus = 'disconnected';
  private readonly publicWsUrl: string;
  private readonly privateWsUrl: string;
  private logger = createLogger('kraken-websocket');
  private reconnectTimer?: NodeJS.Timeout;
  private pingTimer?: NodeJS.Timeout;
  private privatePingTimer?: NodeJS.Timeout;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;
  private autoReconnect = true;
  private pingInterval = 30000;
  private readonly dataMapper = new KrakenDataMapper();
  private nextReqId = 1;
  private authToken?: string;
  private auth?: KrakenAuth;
  private pendingCancelRequests = new Map<
    number,
    { resolve: () => void; reject: (error: Error) => void; timestamp: number }
  >();

  constructor(
    publicWsUrl: string = 'wss://ws.kraken.com/v2',
    privateWsUrl: string = 'wss://ws-auth.kraken.com/v2'
  ) {
    this.publicWsUrl = publicWsUrl;
    this.privateWsUrl = privateWsUrl;
  }

  setCredentials(apiKey: string, apiSecret: string): void {
    this.auth = new KrakenAuth({ apiKey, secret: apiSecret });
  }

  async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.autoReconnect = true;
        this.ws = new WebSocket(this.publicWsUrl);
        this.status = 'connecting';

        this.ws.on('open', () => this.onOpen(resolve));
        this.ws.on('message', (data: Buffer) => this.onMessage(data));
        this.ws.on('close', () => this.onClose());
        this.ws.on('error', error => this.onError(error, reject));
        this.ws.on('pong', () => {});
      } catch (error) {
        this.status = 'error';
        reject(error);
      }
    });
  }

  private onOpen(resolve: () => void): void {
    this.status = 'connected';
    this.reconnectAttempts = 0;
    this.startPing();
    this.logger.info('✅ Kraken public WebSocket connected successfully');

    this.resubscribeAll();
    resolve();
  }

  private onClose(): void {
    this.status = 'disconnected';
    this.stopPing();

    this.logger.warn('🔌 Kraken public WebSocket connection closed');

    if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('❌ Max reconnection attempts reached, giving up');
    }
  }

  private onError(error: Error, reject?: (error: Error) => void): void {
    this.status = 'error';
    this.logger.error('❌ Kraken public WebSocket error:', { error: error.message });

    if (this.reconnectAttempts === 0 && reject) {
      reject(error);
    }
  }

  private onMessage(data: Buffer): void {
    try {
      const message = data.toString();
      const parsedMessage = JSON.parse(message);

      if (parsedMessage.channel === 'heartbeat') {
        return;
      }

      if (parsedMessage.channel === 'status' && parsedMessage.type === 'update') {
        this.logger.debug('Kraken status update:', parsedMessage.data);
        return;
      }

      if (parsedMessage.type === 'subscribe' || parsedMessage.type === 'unsubscribe') {
        this.handleSubscriptionResponse(parsedMessage);
        return;
      }

      if (parsedMessage.type === 'update' || parsedMessage.type === 'snapshot') {
        this.processMarketData(parsedMessage);
      }
    } catch (error) {
      this.logger.error('❌ Error processing Kraken message:', {
        error,
        message: data.toString().substring(0, 200),
      });
    }
  }

  private handleSubscriptionResponse(message: KrakenWebSocketMessage): void {
    const subscription = Array.from(this.subscriptions.values()).find(
      sub => sub.reqId === message.req_id
    );

    if (message.success === false || message.error) {
      this.logger.error('❌ Subscription failed:', {
        error: message.error,
        reqId: message.req_id,
      });

      if (subscription && subscription.type === 'orders' && subscription.reject) {
        subscription.reject(new Error(message.error || 'Subscription failed'));
      }
      return;
    }

    if (message.req_id && message.type === 'subscribe') {
      this.logger.info('✅ Subscription successful:', {
        reqId: message.req_id,
        subscription: message.subscription,
      });

      if (subscription && subscription.type === 'orders' && subscription.resolve) {
        subscription.resolve();
      }
    }
  }

  private processMarketData(message: KrakenWebSocketMessage): void {
    try {
      const { channel, data, symbol } = message;

      if (!channel || !data || !Array.isArray(data)) {
        return;
      }

      // Map Kraken channels to subscription types
      let subscriptionType: 'ticker' | 'orderbook' | 'trades' | undefined;
      switch (channel) {
        case 'ticker':
          subscriptionType = 'ticker';
          break;
        case 'book':
          subscriptionType = 'orderbook';
          break;
        case 'trade':
          subscriptionType = 'trades';
          break;
        default:
          return;
      }

      const subscriptions = Array.from(this.subscriptions.values()).filter(
        sub => sub.type === subscriptionType && (!symbol || sub.symbol === symbol)
      );

      if (subscriptions.length === 0) {
        return;
      }

      switch (subscriptionType) {
        case 'ticker':
          this.handleTickerData(data, subscriptions);
          break;
        case 'orderbook':
          this.handleOrderBookData(data, subscriptions);
          break;
        case 'trades':
          this.handleTradeData(data, subscriptions);
          break;
      }
    } catch (error) {
      this.logger.error('Error processing market data:', {
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  private handleTickerData(data: unknown[], subscriptions: KrakenSubscriptionInfo[]): void {
    for (const rawData of data) {
      const tickerData = rawData as KrakenRawTickerData;
      const ticker = this.dataMapper.mapWebSocketTicker(tickerData);

      for (const sub of subscriptions) {
        if (
          sub.symbol &&
          tickerData.symbol === KrakenUtils.toKrakenSymbol(sub.symbol) &&
          sub.type === 'ticker'
        ) {
          ticker.symbol = sub.symbol;
          (sub.callback as (data: Ticker) => void)(ticker);
        }
      }
    }
  }

  private handleOrderBookData(data: unknown[], subscriptions: KrakenSubscriptionInfo[]): void {
    for (const rawData of data) {
      const bookData = rawData as KrakenRawOrderBookData;
      const orderBook = this.dataMapper.mapWebSocketOrderBook(bookData);

      for (const sub of subscriptions) {
        if (
          sub.symbol &&
          bookData.symbol === KrakenUtils.toKrakenSymbol(sub.symbol) &&
          sub.type === 'orderbook'
        ) {
          orderBook.symbol = sub.symbol;
          (sub.callback as (data: OrderBook) => void)(orderBook);
        }
      }
    }
  }

  private handleTradeData(data: unknown[], subscriptions: KrakenSubscriptionInfo[]): void {
    for (const rawData of data) {
      const tradeData = rawData as KrakenRawTradeData;
      const trade = this.dataMapper.mapWebSocketTrade(tradeData);

      for (const sub of subscriptions) {
        if (
          sub.symbol &&
          tradeData.symbol === KrakenUtils.toKrakenSymbol(sub.symbol) &&
          sub.type === 'trades'
        ) {
          trade.symbol = sub.symbol;
          (sub.callback as (data: Trade) => void)(trade);
        }
      }
    }
  }

  async subscribeTicker(symbol: string, callback: (ticker: Ticker) => void): Promise<string> {
    const subscriptionId = `ticker_${symbol}_${Date.now()}`;
    const krakenSymbol = KrakenUtils.toKrakenSymbol(symbol);
    const reqId = this.getNextReqId();

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      type: 'ticker',
      symbol,
      callback,
      reqId,
    });

    const subscribeMessage = {
      method: 'subscribe',
      params: {
        channel: 'ticker',
        symbol: [krakenSymbol],
        snapshot: true,
      },
      req_id: reqId,
    };

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(subscribeMessage));
      this.logger.info('📊 Subscribed to ticker:', { symbol, reqId });
    }

    return subscriptionId;
  }

  async subscribeOrderBook(
    symbol: string,
    callback: (orderbook: OrderBook) => void
  ): Promise<string> {
    const subscriptionId = `orderbook_${symbol}_${Date.now()}`;
    const krakenSymbol = KrakenUtils.toKrakenSymbol(symbol);
    const reqId = this.getNextReqId();

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      type: 'orderbook',
      symbol,
      callback,
      reqId,
    });

    const subscribeMessage = {
      method: 'subscribe',
      params: {
        channel: 'book',
        symbol: [krakenSymbol],
        depth: 100,
        snapshot: true,
      },
      req_id: reqId,
    };

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(subscribeMessage));
      this.logger.info('📚 Subscribed to order book:', { symbol, reqId });
    }

    return subscriptionId;
  }

  async subscribeTrades(symbol: string, callback: (trade: Trade) => void): Promise<string> {
    const subscriptionId = `trades_${symbol}_${Date.now()}`;
    const krakenSymbol = KrakenUtils.toKrakenSymbol(symbol);
    const reqId = this.getNextReqId();

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      type: 'trades',
      symbol,
      callback,
      reqId,
    });

    const subscribeMessage = {
      method: 'subscribe',
      params: {
        channel: 'trade',
        symbol: [krakenSymbol],
        snapshot: false,
      },
      req_id: reqId,
    };

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(subscribeMessage));
      this.logger.info('💹 Subscribed to trades:', { symbol, reqId });
    }

    return subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      this.logger.warn('Subscription not found:', { subscriptionId });
      return;
    }

    // Map subscription type to Kraken channel
    let channel: string;
    switch (subscription.type) {
      case 'ticker':
        channel = 'ticker';
        break;
      case 'orderbook':
        channel = 'book';
        break;
      case 'trades':
        channel = 'trade';
        break;
      default:
        channel = 'executions'; // for orders and user_trades
    }

    const krakenSymbol = KrakenUtils.toKrakenSymbol(subscription.symbol || '');
    const reqId = this.getNextReqId();

    const unsubscribeMessage = {
      method: 'unsubscribe',
      params: {
        channel,
        symbol: [krakenSymbol],
      },
      req_id: reqId,
    };

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(unsubscribeMessage));
      this.logger.info('🔕 Unsubscribed:', { subscriptionId, type: subscription.type });
    }

    this.subscriptions.delete(subscriptionId);
  }

  async connectPrivateWebSocket(): Promise<void> {
    if (!this.auth) {
      throw new Error('API credentials not set');
    }

    return new Promise((resolve, reject) => {
      try {
        this.privateWs = new WebSocket(this.privateWsUrl);
        this.privateStatus = 'connecting';

        this.privateWs.on('open', () => this.onPrivateOpen(resolve));
        this.privateWs.on('message', (data: Buffer) => this.onPrivateMessage(data));
        this.privateWs.on('close', () => this.onPrivateClose());
        this.privateWs.on('error', error => this.onPrivateError(error, reject));
        this.privateWs.on('pong', () => {});
      } catch (error) {
        this.privateStatus = 'error';
        reject(error);
      }
    });
  }

  private async onPrivateOpen(resolve: () => void): Promise<void> {
    this.privateStatus = 'connected';
    this.startPrivatePing();
    this.logger.info('✅ Kraken private WebSocket connected successfully');

    await this.authenticatePrivateWebSocket();
    resolve();
  }

  private async authenticatePrivateWebSocket(): Promise<void> {
    if (!this.auth) {
      throw new Error('API credentials not set');
    }

    try {
      const data = (await this.auth.makeRequest(
        'https://api.kraken.com/0/private/GetWebSocketsToken',
        '/0/private/GetWebSocketsToken'
      )) as { token: string };

      this.authToken = data.token;
      this.logger.info('✅ Obtained WebSocket auth token');
    } catch (error) {
      this.logger.error('Failed to authenticate private WebSocket:', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  private onPrivateClose(): void {
    this.privateStatus = 'disconnected';
    this.stopPrivatePing();
    this.logger.warn('🔌 Kraken private WebSocket connection closed');
  }

  private onPrivateError(error: Error, reject?: (error: Error) => void): void {
    this.privateStatus = 'error';
    this.logger.error('❌ Kraken private WebSocket error:', { error: error.message });

    if (reject) {
      reject(error);
    }
  }

  private onPrivateMessage(data: Buffer): void {
    try {
      const message = data.toString();
      const parsedMessage = JSON.parse(message);

      if (parsedMessage.channel === 'executions') {
        this.handleUserOrderUpdate(parsedMessage);
      } else if (parsedMessage.type === 'update' && parsedMessage.channel === 'executions') {
        this.handleUserOrderUpdate(parsedMessage);
      } else if (parsedMessage.method === 'subscribe' && parsedMessage.success) {
      } else if (parsedMessage.type === 'snapshot' && parsedMessage.channel === 'executions') {
        this.handleUserOrderUpdate(parsedMessage);
      } else if (parsedMessage.method === 'cancel_all') {
        this.handleCancelAllResponse(parsedMessage);
      }
    } catch (error) {
      this.logger.error('❌ Error processing Kraken private message:', {
        error,
        message: data.toString().substring(0, 200),
      });
    }
  }

  private handleUserOrderUpdate(message: any): void {
    const orderSubscriptions = Array.from(this.subscriptions.values()).filter(
      sub => sub.type === 'orders'
    );
    const tradeSubscriptions = Array.from(this.subscriptions.values()).filter(
      sub => sub.type === 'user_trades'
    );

    if (!message.data || !Array.isArray(message.data)) {
      return;
    }

    // Handle order updates
    for (const sub of orderSubscriptions) {
      const orders = message.data.map((orderData: any) => {
        return this.dataMapper.mapWebSocketOrder(orderData);
      });

      orders.forEach((order: Order) => {
        if (sub.type === 'orders') {
          (sub.callback as (data: Order) => void)(order);
        }
      });
    }

    // Handle trade updates
    for (const sub of tradeSubscriptions) {
      const trades = message.data
        .filter((data: any) => data.exec_type === 'trade')
        .map((tradeData: any) => this.dataMapper.mapWebSocketTrade(tradeData));

      trades.forEach((trade: Trade) => {
        if (sub.type === 'user_trades') {
          (sub.callback as (data: Trade) => void)(trade);
        }
      });
    }
  }

  private handleCancelAllResponse(message: any): void {
    const reqId = message.req_id;
    const pending = this.pendingCancelRequests.get(reqId);

    if (!pending) {
      return;
    }

    this.pendingCancelRequests.delete(reqId);

    if (message.success === false || message.error) {
      this.logger.error('❌ cancel_all failed:', {
        error: message.error,
        reqId,
      });
      pending.reject(new Error(message.error || 'cancel_all failed'));
    } else {
      this.logger.info(`✅ Cancelled ${message.result?.count || 0} orders via WebSocket`);
      pending.resolve();
    }

    const now = Date.now();
    for (const [id, req] of this.pendingCancelRequests.entries()) {
      if (now - req.timestamp > 30000) {
        this.pendingCancelRequests.delete(id);
        req.reject(new Error('cancel_all request timed out'));
      }
    }
  }

  async subscribeUserOrders(callback: (order: Order) => void): Promise<string> {
    if (!this.authToken) {
      throw new Error('Not authenticated to private WebSocket');
    }

    let attempts = 0;
    while (this.privateWs?.readyState !== WebSocket.OPEN && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (this.privateWs?.readyState !== WebSocket.OPEN) {
      throw new Error('Private WebSocket not ready after 5 seconds');
    }

    const subscriptionId = `user_orders_${Date.now()}`;
    const reqId = this.getNextReqId();

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      type: 'orders',
      symbol: '',
      callback,
      reqId,
    });

    const subscribeMessage = {
      method: 'subscribe',
      params: {
        channel: 'executions',
        token: this.authToken,
        snapshot: true,
      },
      req_id: reqId,
    };

    this.privateWs.send(JSON.stringify(subscribeMessage));

    await new Promise(resolve => setTimeout(resolve, 1000));

    return subscriptionId;
  }

  async subscribeUserTrades(callback: (trade: Trade) => void): Promise<string> {
    if (!this.authToken) {
      throw new Error('Not authenticated to private WebSocket');
    }

    const subscriptionId = `user_trades_${Date.now()}`;
    const reqId = this.getNextReqId();

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      type: 'user_trades',
      symbol: '',
      callback,
      reqId,
    });

    const subscribeMessage = {
      method: 'subscribe',
      params: {
        channel: 'executions',
        snapshot_trades: true,
        token: this.authToken,
      },
      req_id: reqId,
    };

    if (this.privateWs?.readyState === WebSocket.OPEN) {
      this.privateWs.send(JSON.stringify(subscribeMessage));
      this.logger.info('👤 Subscribed to user trades');
    }

    return subscriptionId;
  }

  async cancelAllOrders(symbol?: string): Promise<void> {
    if (!this.authToken) {
      throw new Error('Not authenticated to private WebSocket');
    }

    if (this.privateWs?.readyState !== WebSocket.OPEN) {
      throw new Error('Private WebSocket not connected');
    }

    const reqId = this.getNextReqId();

    const responsePromise = new Promise<void>((resolve, reject) => {
      this.pendingCancelRequests.set(reqId, {
        resolve,
        reject,
        timestamp: Date.now(),
      });

      // Set timeout for response
      setTimeout(() => {
        if (this.pendingCancelRequests.has(reqId)) {
          this.pendingCancelRequests.delete(reqId);
          reject(new Error('cancel_all request timed out after 10 seconds'));
        }
      }, 10000);
    });

    const cancelMessage: any = {
      method: 'cancel_all',
      params: {
        token: this.authToken,
      },
      req_id: reqId,
    };

    if (symbol) {
      this.logger.warn(
        '⚠️ Kraken WebSocket v2 cancel_all does not support filtering by symbol - cancelling ALL orders'
      );
    }

    this.privateWs.send(JSON.stringify(cancelMessage));

    try {
      await responsePromise;
    } catch (error) {
      this.logger.error('❌ Failed to cancel orders via WebSocket:', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        const pingMessage = {
          method: 'ping',
          req_id: this.getNextReqId(),
        };
        this.ws.send(JSON.stringify(pingMessage));
      }
    }, this.pingInterval);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
  }

  private startPrivatePing(): void {
    this.privatePingTimer = setInterval(() => {
      if (this.privateWs?.readyState === WebSocket.OPEN) {
        const pingMessage = {
          method: 'ping',
          req_id: this.getNextReqId(),
        };
        this.privateWs.send(JSON.stringify(pingMessage));
      }
    }, this.pingInterval);
  }

  private stopPrivatePing(): void {
    if (this.privatePingTimer) {
      clearInterval(this.privatePingTimer);
      this.privatePingTimer = undefined;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    this.logger.info(`⏳ Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connectWebSocket().catch(error => {
        this.logger.error('Reconnection failed:', {
          error: error instanceof Error ? error.message : error,
        });
      });
    }, delay);
  }

  private resubscribeAll(): void {
    for (const [, subscription] of this.subscriptions) {
      if (subscription.type === 'ticker') {
        this.subscribeTicker(
          subscription.symbol,
          subscription.callback as (ticker: Ticker) => void
        );
      } else if (subscription.type === 'orderbook') {
        this.subscribeOrderBook(
          subscription.symbol,
          subscription.callback as (orderBook: OrderBook) => void
        );
      } else if (subscription.type === 'trades') {
        this.subscribeTrades(subscription.symbol, subscription.callback as (trade: Trade) => void);
      }
    }
  }

  private getNextReqId(): number {
    return this.nextReqId++;
  }

  async disconnectWebSocket(): Promise<void> {
    this.autoReconnect = false;
    this.stopPing();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }

    this.status = 'disconnected';
    this.subscriptions.clear();
    this.logger.info('🔌 Kraken public WebSocket disconnected');
  }

  async disconnectPrivateWebSocket(): Promise<void> {
    this.stopPrivatePing();

    if (this.privateWs) {
      this.privateWs.close();
      this.privateWs = undefined;
    }

    this.privateStatus = 'disconnected';
    this.authToken = undefined;
    this.logger.info('🔌 Kraken private WebSocket disconnected');
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  isPrivateConnected(): boolean {
    return this.privateWs?.readyState === WebSocket.OPEN;
  }

  getStatus(): WebSocketStatus {
    return this.status;
  }
}
