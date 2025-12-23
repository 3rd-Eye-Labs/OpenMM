import WebSocket from 'ws';
import { Order, Trade, WebSocketStatus, ExchangeCredentials } from '../../types';
import { GateioSubscriptionInfo } from '../../types';
import { GateioDataMapper } from './gateio-data-mapper';
import { GateioUtils } from './gateio-utils';
import { GateioAuth } from './gateio-auth';
import { createLogger } from '../../utils';

/**
 * Gate.io User Data Stream
 *
 * Handles authenticated WebSocket connections for private user data including:
 * - Order updates (spot.orders channel)
 * - Trade executions (spot.usertrades channel)
 * - Account balance updates (spot.balances channel)
 *
 * Gate.io WebSocket API v4 for User Data:
 * - Uses same WebSocket endpoint as public data: wss://api.gateio.ws/ws/v4/
 * - Authentication required for private channels
 * - Real-time updates for user-specific data
 */
export class GateioUserDataStream {
  private ws?: WebSocket;
  private subscriptions = new Map<string, GateioSubscriptionInfo>();
  private status: WebSocketStatus = 'disconnected';
  private readonly wsUrl: string;
  private logger = createLogger('gateio-user-stream');
  private reconnectTimer?: NodeJS.Timeout;
  private pingTimer?: NodeJS.Timeout;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;
  private autoReconnect = true;
  private pingInterval = 30000;
  private readonly dataMapper = new GateioDataMapper();
  private credentials: ExchangeCredentials;
  private isAuthenticated = false;
  private auth: GateioAuth;

  constructor(credentials: ExchangeCredentials, wsUrl: string = 'wss://api.gateio.ws/ws/v4/') {
    this.wsUrl = wsUrl;
    this.credentials = credentials;
    this.auth = new GateioAuth(credentials, 'https://api.gateio.ws');
  }

  /**
   * Connect to Gate.io User Data Stream with authentication
   *
   * @returns Promise that resolves when connection is established and authenticated
   */
  async connectUserDataStream(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.autoReconnect = true;
        this.ws = new WebSocket(this.wsUrl);
        this.status = 'connecting';

        this.ws.on('open', () => this.onOpen(resolve, reject));
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
  private onOpen(resolve: () => void, reject: (error: Error) => void): void {
    this.status = 'connected';
    this.isAuthenticated = true; // Authentication happens per-subscription
    this.reconnectAttempts = 0;
    this.startPing();
    this.logger.info('✅ Gate.io User Data Stream connected successfully');

    this.resubscribeAll()
      .then(() => {
        resolve();
      })
      .catch(error => {
        this.logger.error('❌ Failed to resubscribe:', { error });
        reject(error instanceof Error ? error : new Error('Resubscription failed'));
      });
  }

  /**
   * WebSocket close event handler
   */
  private onClose(): void {
    this.status = 'disconnected';
    this.isAuthenticated = false;
    this.stopPing();

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
    this.logger.error('❌ Gate.io User Data Stream error:', { error: error.message });

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
        if (parsedMessage.result?.status === 'fail') {
          const errorMsg = parsedMessage.error?.message || 'Unknown error';

          if (errorMsg.includes('INVALID_KEY')) {
            this.logger.error(
              '🔑 Authentication failed: Invalid API credentials provided for private channel subscription'
            );
          }
        }
        return;
      }

      if (parsedMessage.event === 'update' && parsedMessage.result) {
        this.processPrivateChannelData(parsedMessage);
      }
    } catch (error) {
      this.logger.error('❌ Error processing Gate.io User Data Stream message:', {
        error,
        message: data.toString().substring(0, 200),
      });
    }
  }

  /**
   * Process private channel data messages
   */
  private processPrivateChannelData(message: any): void {
    try {
      const { channel, result } = message;

      if (!channel || !result) {
        return;
      }

      if (channel === 'spot.orders') {
        this.handleOrderUpdates(result);
      } else if (channel === 'spot.usertrades') {
        this.handleUserTradeUpdates(result);
      } else if (channel === 'spot.balances') {
        this.handleBalanceUpdates(result);
      } else {
        this.logger.debug('🔄 Unknown private channel:', channel);
      }
    } catch (error) {
      this.logger.error('❌ Error processing private channel data:', { error, message });
    }
  }

  /**
   * Handle order status updates from spot.orders channel
   */
  private handleOrderUpdates(result: any[]): void {
    try {
      if (!Array.isArray(result)) return;

      result.forEach((orderData: any) => {
        const order = this.dataMapper.mapWebSocketOrder(orderData);
        const symbol = GateioUtils.fromGateioSymbol(orderData.currency_pair);

        this.subscriptions.forEach(subscription => {
          if (
            subscription.type === 'orders' &&
            (subscription.symbol === symbol || subscription.symbol === 'all')
          ) {
            subscription.callback(order);
          }
        });
      });
    } catch (error) {
      this.logger.error('❌ Error handling order updates:', { error, result });
    }
  }

  /**
   * Handle user trade execution updates from spot.usertrades channel
   */
  private handleUserTradeUpdates(result: any[]): void {
    try {
      if (!Array.isArray(result)) return;

      result.forEach((tradeData: any) => {
        const trade = this.dataMapper.mapTrade(tradeData, tradeData.currency_pair);
        const symbol = GateioUtils.fromGateioSymbol(tradeData.currency_pair);

        this.subscriptions.forEach(subscription => {
          if (
            subscription.type === 'usertrades' &&
            (subscription.symbol === symbol || subscription.symbol === 'all')
          ) {
            subscription.callback(trade);
          }
        });
      });
    } catch (error) {
      this.logger.error('❌ Error handling user trade updates:', { error, result });
    }
  }

  /**
   * Handle balance updates from spot.balances channel
   */
  private handleBalanceUpdates(result: any[]): void {
    try {
      if (!Array.isArray(result)) return;

      const balances = this.dataMapper.mapAccountBalances(result);

      this.subscriptions.forEach(subscription => {
        if (subscription.type === 'balances') {
          subscription.callback(balances);
        }
      });
    } catch (error) {
      this.logger.error('❌ Error handling balance updates:', { error, result });
    }
  }

  /**
   * Subscribe to real-time user order updates
   *
   * @param callback - Function called when user's order status changes
   * @param symbol - Optional trading pair symbol or 'all' for all symbols
   * @returns Promise resolving to subscription ID
   */
  async subscribeUserOrders(
    callback: (order: Order) => void,
    symbol: string = 'all'
  ): Promise<string> {
    if (!this.isAuthenticated) {
      throw new Error('Authentication required for user order subscriptions');
    }

    const subscriptionId = `user_orders_${symbol}_${Date.now()}`;
    const payload = symbol === 'all' ? ['!all'] : [GateioUtils.toGateioSymbol(symbol)];

    this.subscriptions.set(subscriptionId, {
      callback,
      type: 'orders',
      symbol,
      channel: 'spot.orders',
    });

    await this.subscribe('spot.orders', payload);
    return subscriptionId;
  }

  /**
   * Subscribe to real-time user trade execution updates
   *
   * @param callback - Function called when user's trades are executed
   * @param symbol - Optional trading pair symbol or 'all' for all symbols
   * @returns Promise resolving to subscription ID
   */
  async subscribeUserTrades(
    callback: (trade: Trade) => void,
    symbol: string = 'all'
  ): Promise<string> {
    if (!this.isAuthenticated) {
      throw new Error('Authentication required for user trade subscriptions');
    }

    const subscriptionId = `user_trades_${symbol}_${Date.now()}`;
    const payload = symbol === 'all' ? ['!all'] : [GateioUtils.toGateioSymbol(symbol)];

    this.subscriptions.set(subscriptionId, {
      callback,
      type: 'usertrades',
      symbol,
      channel: 'spot.usertrades',
    });

    await this.subscribe('spot.usertrades', payload);
    return subscriptionId;
  }

  /**
   * Send subscription message to Gate.io with authentication
   */
  private async subscribe(channel: string, payload: string[]): Promise<void> {
    if (this.status !== 'connected' || !this.ws) {
      throw new Error('User Data Stream not connected');
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.auth.generateWebSocketSignature(channel, 'subscribe', timestamp);

    const message = {
      time: timestamp,
      channel,
      event: 'subscribe',
      payload,
      auth: {
        method: 'api_key',
        KEY: this.credentials.apiKey,
        SIGN: signature,
      },
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
    this.logger.debug(
      `🔄 Scheduling user stream reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms`
    );

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connectUserDataStream();
      } catch (error) {
        this.logger.error('❌ User stream reconnection failed:', { error });
      }
    }, this.reconnectDelay);
  }

  /**
   * Resubscribe to all active subscriptions
   */
  private async resubscribeAll(): Promise<void> {
    if (this.subscriptions.size === 0) return;

    if (!this.isAuthenticated) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    for (const [id, subscription] of this.subscriptions) {
      try {
        const { symbol, channel } = subscription;

        let payload: string[];
        if (symbol === 'all') {
          payload = ['!all'];
        } else {
          payload = [GateioUtils.toGateioSymbol(symbol)];
        }

        await this.subscribe(channel, payload);
      } catch (error) {
        this.logger.error('❌ Failed to resubscribe to private channel:', { id, error });
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
   * Disconnect from user data stream
   */
  async disconnectUserDataStream(): Promise<void> {
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
    this.isAuthenticated = false;
  }

  /**
   * Check if user data stream is connected
   */
  isUserDataStreamConnected(): boolean {
    return this.status === 'connected' && this.isAuthenticated;
  }
}
