import WebSocket from 'ws';
import { OrderBook, Ticker, Trade, WebSocketStatus } from '../../types';
import { BitgetSubscriptionInfo } from '../../types';
import { BitgetDataMapper } from './bitget-data-mapper';
import { createLogger } from '../../utils';
import { toExchangeFormat } from '../../utils/symbol-utils';

/**
 * Bitget WebSocket Client
 * 
 * Provides real-time market data streaming for Bitget exchange.
 * Implements public market data channels including ticker, orderbook, and trades.
 */
export class BitgetWebSocket {
  private ws?: WebSocket;
  private subscriptions = new Map<string, BitgetSubscriptionInfo>();
  private status: WebSocketStatus = 'disconnected';
  private readonly wsUrl: string;
  private logger = createLogger('bitget-websocket');
  private reconnectTimer?: NodeJS.Timeout;
  private pingTimer?: NodeJS.Timeout;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;
  private autoReconnect = true;
  private pingInterval = 30000;
  private readonly dataMapper = new BitgetDataMapper();

  constructor(wsUrl: string = 'wss://ws.bitget.com/v2/ws/public') {
    this.wsUrl = wsUrl;
  }

  /**
   * Connect to Bitget WebSocket
   * 
   * @returns Promise that resolves when connection is established
   */
  async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.autoReconnect = true;
        this.ws = new WebSocket(this.wsUrl);
        this.status = 'connecting';

        this.ws.on('open', () => this.onOpen(resolve));
        this.ws.on('message', (data: Buffer) => this.onMessage(data));
        this.ws.on('close', () => this.onClose());
        this.ws.on('error', (error) => this.onError(error, reject));

      } catch (error) {
        this.status = 'error';
        reject(error);
      }
    });
  }

  /**
   * WebSocket open event handler
   */
  private onOpen(resolve: () => void): void {
    this.status = 'connected';
    this.reconnectAttempts = 0;
    this.startPing();
    this.logger.info('✅ Bitget WebSocket connected successfully');
    
    this.resubscribeAll();
    
    resolve();
  }

  /**
   * WebSocket close event handler
   */
  private onClose(): void {
    this.status = 'disconnected';
    this.stopPing();
    
    this.logger.warn('🔌 WebSocket connection closed');
    
    if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('❌ Max reconnection attempts reached, giving up');
    }
  }

  /**
   * WebSocket error event handler
   */
  private onError(error: Error, reject?: (error: Error) => void): void {
    this.status = 'error';
    this.logger.error('❌ Bitget WebSocket error:', { error: error.message });
    
    if (this.reconnectAttempts === 0 && reject) {
      reject(error);
    }
  }

  /**
   * WebSocket message handler
   */
  private onMessage(data: Buffer): void {
    try {
      const message = data.toString();
      const parsedMessage = JSON.parse(message);

      if (parsedMessage.event === 'pong') {
        this.logger.debug('📡 Received pong');
        return;
      }

      if (parsedMessage.event === 'subscribe') {
        this.logger.info('✅ Subscription confirmed:', { arg: parsedMessage.arg });
        return;
      }

      if (parsedMessage.data) {
        this.processSubscriptionData(parsedMessage);
      }

    } catch (error) {
      this.logger.error('❌ Error processing message:', { error, message: data.toString().substring(0, 200) });
    }
  }

  /**
   * Process subscription data messages
   */
  private processSubscriptionData(message: any): void {
    try {
      const { arg, data } = message;
      
      if (!arg || !data) {
        this.logger.warn('⚠️ Invalid message format:', { arg, hasData: !!data });
        return;
      }

      if (arg.channel === 'ticker') {
        this.handleTickerData(arg.instId, data);
      } else if (arg.channel === 'books15') {
        this.handleOrderBookData(arg.instId, data);
      } else if (arg.channel === 'trade') {
        this.handleTradeData(arg.instId, data);
      } else {
        this.logger.debug('🔄 Unknown channel data:', { channel: arg.channel, instId: arg.instId });
      }

    } catch (error) {
      this.logger.error('❌ Error processing subscription data:', { error, message });
    }
  }

  /**
   * Handle ticker data
   */
  private handleTickerData(instId: string, data: any[]): void {
    try {
      if (!Array.isArray(data) || data.length === 0) return;

      const tickerData = data[0];
      const tickerForMapping = {
        ...tickerData,
        symbol: tickerData.instId || instId
      };
      
      const ticker = this.dataMapper.mapTicker(tickerForMapping);
      
      this.subscriptions.forEach((subscription, id) => {
        if (subscription.type === 'ticker' && id.includes(instId)) {
          subscription.callback(ticker);
        }
      });

    } catch (error) {
      this.logger.error('❌ Error handling ticker data:', { error, instId, data });
    }
  }

  /**
   * Handle order book data
   */
  private handleOrderBookData(instId: string, data: any[]): void {
    try {
      if (!Array.isArray(data) || data.length === 0) return;

      const orderBookData = data[0];
      const orderBook = this.dataMapper.mapOrderBook(orderBookData, instId);
      
      this.subscriptions.forEach((subscription, id) => {
        if (subscription.type === 'orderbook' && id.includes(instId)) {
          subscription.callback(orderBook);
        }
      });

    } catch (error) {
      this.logger.error('❌ Error handling order book data:', { error, instId, data });
    }
  }

  /**
   * Handle trade data
   */
  private handleTradeData(instId: string, data: any[]): void {
    try {
      if (!Array.isArray(data) || data.length === 0) return;

      data.forEach(tradeData => {
        const trade = this.dataMapper.mapTrade(tradeData, instId);
        
        this.subscriptions.forEach((subscription, id) => {
          if (subscription.type === 'trades' && id.includes(instId)) {
            subscription.callback(trade);
          }
        });
      });

    } catch (error) {
      this.logger.error('❌ Error handling trade data:', { error, instId, data });
    }
  }

  /**
   * Subscribe to ticker updates for a symbol
   * 
   * @param symbol - Trading pair symbol (e.g., 'SNEK/USDT')
   * @param callback - Function called when ticker updates are received
   * @returns Promise resolving to subscription ID
   */
  async subscribeTicker(symbol: string, callback: (ticker: Ticker) => void): Promise<string> {
    const bitgetSymbol = toExchangeFormat(symbol);
    const subscriptionId = `ticker_${bitgetSymbol}_${Date.now()}`;
    
    this.subscriptions.set(subscriptionId, {
      callback,
      type: 'ticker',
      symbol: bitgetSymbol
    });

    await this.subscribe({
      op: 'subscribe',
      args: [{
        instType: 'SPOT',
        channel: 'ticker',
        instId: bitgetSymbol
      }]
    });

    this.logger.info(`📈 Subscribed to ticker: ${symbol} (${bitgetSymbol})`);
    return subscriptionId;
  }

  /**
   * Subscribe to order book updates for a symbol
   * 
   * @param symbol - Trading pair symbol (e.g., 'SNEK/USDT')
   * @param callback - Function called when order book updates are received
   * @returns Promise resolving to subscription ID
   */
  async subscribeOrderBook(symbol: string, callback: (orderbook: OrderBook) => void): Promise<string> {
    const bitgetSymbol = toExchangeFormat(symbol);
    const subscriptionId = `orderbook_${bitgetSymbol}_${Date.now()}`;
    
    this.subscriptions.set(subscriptionId, {
      callback,
      type: 'orderbook',
      symbol: bitgetSymbol
    });

    await this.subscribe({
      op: 'subscribe',
      args: [{
        instType: 'SPOT',
        channel: 'books15',
        instId: bitgetSymbol
      }]
    });

    this.logger.info(`📊 Subscribed to order book: ${symbol} (${bitgetSymbol})`);
    return subscriptionId;
  }

  /**
   * Subscribe to trade updates for a symbol
   * 
   * @param symbol - Trading pair symbol (e.g., 'SNEK/USDT')
   * @param callback - Function called when new trades are received
   * @returns Promise resolving to subscription ID
   */
  async subscribeTrades(symbol: string, callback: (trade: Trade) => void): Promise<string> {
    const bitgetSymbol = toExchangeFormat(symbol);
    const subscriptionId = `trades_${bitgetSymbol}_${Date.now()}`;
    
    this.subscriptions.set(subscriptionId, {
      callback,
      type: 'trades',
      symbol: bitgetSymbol
    });

    await this.subscribe({
      op: 'subscribe',
      args: [{
        instType: 'SPOT',
        channel: 'trade',
        instId: bitgetSymbol
      }]
    });

    this.logger.info(`💱 Subscribed to trades: ${symbol} (${bitgetSymbol})`);
    return subscriptionId;
  }


  /**
   * Unsubscribe from a subscription
   * 
   * @param subscriptionId - The ID of the subscription to cancel
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      this.logger.warn('⚠️ Subscription not found:', { subscriptionId });
      return;
    }

    const { symbol } = subscription;
    this.subscriptions.delete(subscriptionId);

    let channel: string;
    if (subscriptionId.startsWith('ticker_')) {
      channel = 'ticker';
    } else if (subscriptionId.startsWith('orderbook_')) {
      channel = 'books15';
    } else if (subscriptionId.startsWith('trades_')) {
      channel = 'trade';
    } else {
      this.logger.warn('⚠️ Unknown subscription type:', { subscriptionId });
      return;
    }

    await this.subscribe({
      op: 'unsubscribe',
      args: [{
        instType: 'SPOT',
        channel,
        instId: symbol
      }]
    });

    this.logger.info(`❌ Unsubscribed: ${subscriptionId}`);
  }

  /**
   * Send subscription/unsubscription message
   */
  private async subscribe(message: any): Promise<void> {
    if (this.status !== 'connected' || !this.ws) {
      throw new Error('WebSocket not connected');
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connectWebSocket();
      } catch (error) {
        this.logger.error('❌ Reconnection failed:', { error });
      }
    }, this.reconnectDelay);
  }

  /**
   * Resubscribe to all active subscriptions
   */
  private async resubscribeAll(): Promise<void> {
    if (this.subscriptions.size === 0) return;

    this.logger.info(`🔄 Resubscribing to ${this.subscriptions.size} subscriptions`);

    for (const [id, subscription] of this.subscriptions) {
      try {
        const { symbol, type } = subscription;
        let channel: string;

        if (type === 'ticker') {
          channel = 'ticker';
        } else if (type === 'orderbook') {
          channel = 'books15';
        } else if (type === 'trades') {
          channel = 'trade';
        } else {
          continue;
        }

        await this.subscribe({
          op: 'subscribe',
          args: [{
            instType: 'SPOT',
            channel,
            instId: symbol
          }]
        });

      } catch (error) {
        this.logger.error('❌ Failed to resubscribe:', { id, error });
      }
    }
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws && this.status === 'connected') {
        this.ws.send(JSON.stringify({ op: 'ping' }));
        this.logger.debug('📡 Sent ping');
      }
    }, this.pingInterval);
  }

  /**
   * Stop ping interval
   */
  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
  }

  /**
   * Disconnect from WebSocket
   */
  async disconnectWebSocket(): Promise<void> {
    this.autoReconnect = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    
    this.stopPing();

    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }

    this.subscriptions.clear();
    this.status = 'disconnected';
    this.logger.info('🔌 Bitget WebSocket disconnected');
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.status === 'connected';
  }

  /**
   * Get current WebSocket status
   */
  getWebSocketStatus(): WebSocketStatus {
    return this.status;
  }
}