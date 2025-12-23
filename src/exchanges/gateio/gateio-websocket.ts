import WebSocket from 'ws';
import { OrderBook, Ticker, Trade, WebSocketStatus } from '../../types';
import { GateioSubscriptionInfo } from '../../types';
import { GateioDataMapper } from './gateio-data-mapper';
import { GateioUtils } from './gateio-utils';
import { createLogger } from '../../utils';

/**
 * Gate.io WebSocket Client
 *
 * Provides real-time market data streaming for Gate.io exchange.
 * Implements public market data channels including ticker, orderbook, and trades.
 *
 * Gate.io WebSocket API v4 Specification:
 * - Endpoint: wss://api.gateio.ws/ws/v4/
 * - Message format: JSON with time, channel, event, result structure
 * - Rate limit: 50 requests/second per channel
 */
export class GateioWebSocket {
  private ws?: WebSocket;
  private subscriptions = new Map<string, GateioSubscriptionInfo>();
  private status: WebSocketStatus = 'disconnected';
  private readonly wsUrl: string;
  private logger = createLogger('gateio-websocket');
  private reconnectTimer?: NodeJS.Timeout;
  private pingTimer?: NodeJS.Timeout;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;
  private autoReconnect = true;
  private pingInterval = 30000;
  private readonly dataMapper = new GateioDataMapper();

  constructor(wsUrl: string = 'wss://api.gateio.ws/ws/v4/') {
    this.wsUrl = wsUrl;
  }

  /**
   * Connect to Gate.io WebSocket
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
        this.ws.on('error', error => this.onError(error, reject));
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
    this.logger.info('✅ Gate.io WebSocket connected successfully');

    this.resubscribeAll();
    resolve();
  }

  /**
   * WebSocket close event handler
   */
  private onClose(): void {
    this.status = 'disconnected';
    this.stopPing();

    this.logger.warn('🔌 Gate.io WebSocket connection closed');

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
    this.logger.error('❌ Gate.io WebSocket error:', { error: error.message });

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

      if (parsedMessage.channel === 'spot.pong') {
        return;
      }

      if (parsedMessage.event === 'subscribe') {
        if (parsedMessage.result?.status === 'fail' || parsedMessage.error) {
          this.logger.error('❌ Subscription failed:', {
            channel: parsedMessage.channel,
            error: parsedMessage.error || parsedMessage.result,
          });
        }
        return;
      }

      if (parsedMessage.event === 'update' && parsedMessage.result) {
        this.processSubscriptionData(parsedMessage);
      }
    } catch (error) {
      this.logger.error('❌ Error processing Gate.io message:', {
        error,
        message: data.toString().substring(0, 200),
      });
    }
  }

  /**
   * Process subscription data messages
   */
  private processSubscriptionData(message: any): void {
    try {
      const { channel, result } = message;

      if (!channel || !result) {
        this.logger.debug('⚠️ Invalid Gate.io message format:', { channel, hasResult: !!result });
        return;
      }

      if (channel === 'spot.tickers') {
        this.handleTickerData(result);
      } else if (channel === 'spot.book_ticker') {
        this.handleBookTickerData(result);
      } else if (channel === 'spot.order_book_update') {
        this.handleOrderBookData(result);
      } else if (channel === 'spot.trades') {
        this.handleTradeData(result);
      } else {
        this.logger.debug('🔄 Unknown Gate.io channel:', channel);
      }
    } catch (error) {
      this.logger.error('❌ Error processing Gate.io subscription data:', { error, message });
    }
  }

  /**
   * Handle ticker data from spot.tickers channel
   */
  private handleTickerData(result: any): void {
    try {
      if (!result || !result.currency_pair) return;

      const ticker = this.dataMapper.mapTicker(result);
      const symbol = GateioUtils.fromGateioSymbol(result.currency_pair);

      this.subscriptions.forEach(subscription => {
        if (subscription.type === 'ticker' && subscription.symbol === symbol) {
          subscription.callback(ticker);
        }
      });
    } catch (error) {
      this.logger.error('❌ Error handling Gate.io ticker data:', { error, result });
    }
  }

  /**
   * Handle best bid/ask data from spot.book_ticker channel
   */
  private handleBookTickerData(result: any): void {
    try {
      if (!result || !result.s) return;

      const tickerData = {
        currency_pair: result.s,
        last: result.c || '0',
        lowest_ask: result.a || '0',
        highest_bid: result.b || '0',
        base_volume: result.v || '0',
        quote_volume: result.q || '0',
        change_percentage: result.P || '0',
        high_24h: result.h || '0',
        low_24h: result.l || '0',
      };

      const ticker = this.dataMapper.mapTicker(tickerData);
      const symbol = GateioUtils.fromGateioSymbol(result.s);

      this.subscriptions.forEach(subscription => {
        if (subscription.type === 'ticker' && subscription.symbol === symbol) {
          subscription.callback(ticker);
        }
      });
    } catch (error) {
      this.logger.error('❌ Error handling Gate.io book ticker data:', { error, result });
    }
  }

  /**
   * Handle order book data from spot.order_book_update channel
   */
  private handleOrderBookData(result: any): void {
    try {
      if (!result || !result.s) return;

      const orderBook = {
        symbol: GateioUtils.fromGateioSymbol(result.s),
        bids: this.parseOrderBookEntries(result.b || []),
        asks: this.parseOrderBookEntries(result.a || []),
        timestamp: result.t || Date.now(),
      };

      const symbol = GateioUtils.fromGateioSymbol(result.s);

      this.subscriptions.forEach(subscription => {
        if (subscription.type === 'orderbook' && subscription.symbol === symbol) {
          subscription.callback(orderBook);
        }
      });
    } catch (error) {
      this.logger.error('❌ Error handling Gate.io order book data:', { error, result });
    }
  }

  /**
   * Parse order book entries from WebSocket format
   */
  private parseOrderBookEntries(
    entries: [string, string][]
  ): Array<{ price: number; amount: number }> {
    return entries
      .map(([price, amount]) => ({
        price: parseFloat(price),
        amount: parseFloat(amount),
      }))
      .filter(entry => entry.amount > 0); // Filter out zero amounts (deletions)
  }

  /**
   * Handle trade data from spot.trades channel
   */
  private handleTradeData(result: any): void {
    try {
      if (!result || !result.currency_pair) return;

      const trade = this.dataMapper.mapTrade(result, result.currency_pair);
      const symbol = GateioUtils.fromGateioSymbol(result.currency_pair);

      this.subscriptions.forEach(subscription => {
        if (subscription.type === 'trades' && subscription.symbol === symbol) {
          subscription.callback(trade);
        }
      });
    } catch (error) {
      this.logger.error('❌ Error handling Gate.io trade data:', { error, result });
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
    const gateioSymbol = GateioUtils.toGateioSymbol(symbol);
    const subscriptionId = `ticker_${gateioSymbol}_${Date.now()}`;

    this.subscriptions.set(subscriptionId, {
      callback,
      type: 'ticker',
      symbol,
      channel: 'spot.tickers',
    });

    await this.subscribe('spot.tickers', [gateioSymbol]);
    return subscriptionId;
  }

  /**
   * Subscribe to order book updates for a symbol
   *
   * @param symbol - Trading pair symbol (e.g., 'SNEK/USDT')
   * @param callback - Function called when order book updates are received
   * @returns Promise resolving to subscription ID
   */
  async subscribeOrderBook(
    symbol: string,
    callback: (orderbook: OrderBook) => void
  ): Promise<string> {
    const gateioSymbol = GateioUtils.toGateioSymbol(symbol);
    const subscriptionId = `orderbook_${gateioSymbol}_${Date.now()}`;

    this.subscriptions.set(subscriptionId, {
      callback,
      type: 'orderbook',
      symbol,
      channel: 'spot.order_book_update',
    });

    await this.subscribe('spot.order_book_update', [gateioSymbol, '100ms']);
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
    const gateioSymbol = GateioUtils.toGateioSymbol(symbol);
    const subscriptionId = `trades_${gateioSymbol}_${Date.now()}`;

    this.subscriptions.set(subscriptionId, {
      callback,
      type: 'trades',
      symbol,
      channel: 'spot.trades',
    });

    await this.subscribe('spot.trades', [gateioSymbol]);
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

    const { symbol, channel } = subscription;
    this.subscriptions.delete(subscriptionId);

    let payload: string[];
    if (channel === 'spot.order_book_update') {
      payload = [GateioUtils.toGateioSymbol(symbol), '100ms'];
    } else if (symbol === 'all') {
      payload = ['all'];
    } else {
      payload = [GateioUtils.toGateioSymbol(symbol)];
    }

    await this.unsubscribeFromChannel(channel, payload);
  }

  /**
   * Send subscription message to Gate.io
   */
  private async subscribe(channel: string, payload: string[]): Promise<void> {
    if (this.status !== 'connected' || !this.ws) {
      throw new Error('Gate.io WebSocket not connected');
    }

    const message = {
      time: Math.floor(Date.now() / 1000),
      channel,
      event: 'subscribe',
      payload,
    };

    this.sendMessage(message);
  }

  /**
   * Send unsubscription message to Gate.io
   */
  private async unsubscribeFromChannel(channel: string, payload: string[]): Promise<void> {
    if (this.status !== 'connected' || !this.ws) {
      throw new Error('Gate.io WebSocket not connected');
    }

    const message = {
      time: Math.floor(Date.now() / 1000),
      channel,
      event: 'unsubscribe',
      payload,
    };

    this.sendMessage(message);
  }

  /**
   * Send message to Gate.io WebSocket
   */
  private sendMessage(message: any): void {
    if (this.ws && this.status === 'connected') {
      this.ws.send(JSON.stringify(message));
    }
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
        this.logger.error('❌ Gate.io reconnection failed:', { error });
      }
    }, this.reconnectDelay);
  }

  /**
   * Resubscribe to all active subscriptions
   */
  private async resubscribeAll(): Promise<void> {
    if (this.subscriptions.size === 0) return;

    for (const [id, subscription] of this.subscriptions) {
      try {
        const { symbol, channel, type } = subscription;

        let payload: string[];
        if (type === 'orderbook') {
          payload = [GateioUtils.toGateioSymbol(symbol), '100ms'];
        } else if (symbol === 'all') {
          payload = ['all'];
        } else {
          payload = [GateioUtils.toGateioSymbol(symbol)];
        }

        await this.subscribe(channel, payload);
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
        const pingMessage = {
          time: Math.floor(Date.now() / 1000),
          channel: 'spot.ping',
          event: 'ping',
        };
        this.sendMessage(pingMessage);
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
   * Disconnect from Gate.io WebSocket
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
