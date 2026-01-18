import WebSocket from 'ws';
import { Order, Trade, WebSocketStatus } from '../../types';
import { BitgetSubscriptionInfo } from '../../types';
import { BitgetAuth } from './bitget-auth';
import { BitgetDataMapper } from './bitget-data-mapper';
import { createLogger } from '../../utils';
import { toExchangeFormat } from '../../utils/symbol-utils';

/**
 * Bitget User Data Stream
 *
 * Handles authenticated WebSocket connections for private user data including:
 * - Order updates (order channel)
 * - Trade executions (fill channel)
 * - Account balance updates (account channel)
 * - WebSocket trading operations (place/cancel orders)
 */
export class BitgetUserDataStream {
  private ws?: WebSocket;
  private subscriptions = new Map<string, BitgetSubscriptionInfo>();
  private status: WebSocketStatus = 'disconnected';
  private readonly wsUrl: string;
  private logger = createLogger('bitget-user-stream');
  private reconnectTimer?: NodeJS.Timeout;
  private pingTimer?: NodeJS.Timeout;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;
  private autoReconnect = true;
  private pingInterval = 30000; // 30 seconds
  private readonly dataMapper = new BitgetDataMapper();
  private auth: BitgetAuth;

  constructor(auth: BitgetAuth, wsUrl: string = 'wss://ws.bitget.com/v2/ws/private') {
    this.wsUrl = wsUrl;
    this.auth = auth;
  }

  /**
   * Connect to Bitget private WebSocket with authentication
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
   * WebSocket open event handler with authentication
   */
  private async onOpen(resolve: () => void, reject: (error: Error) => void): Promise<void> {
    try {
      await this.authenticate();

      this.status = 'connected';
      this.reconnectAttempts = 0;
      this.startPing();
      this.logger.info('✅ Bitget User Data Stream connected and authenticated');

      await this.resubscribeAll();

      resolve();
    } catch (error) {
      this.logger.error('❌ Authentication failed:', { error });
      reject(error instanceof Error ? error : new Error('Authentication failed'));
    }
  }

  /**
   * Authenticate the WebSocket connection using API credentials
   */
  private async authenticate(): Promise<void> {
    const timestamp = Date.now();
    const method = 'GET';
    const requestPath = '/user/verify';
    const queryString = '';
    const body = '';

    const signature = this.auth.generateSignature(
      timestamp,
      method,
      requestPath,
      queryString,
      body
    );
    const credentials = this.auth.getCredentials();

    const authMessage = {
      op: 'login',
      args: [
        {
          apiKey: credentials.apiKey,
          passphrase: credentials.passphrase,
          timestamp: timestamp.toString(),
          sign: signature,
        },
      ],
    };

    if (!this.ws) {
      throw new Error('WebSocket not initialized');
    }

    this.ws.send(JSON.stringify(authMessage));
    await this.waitForAuthConfirmation();
  }

  /**
   * Wait for authentication confirmation from the server
   */
  private waitForAuthConfirmation(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Authentication timeout'));
      }, 10000);

      const messageHandler = (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.event === 'login') {
            clearTimeout(timeout);
            this.ws?.removeListener('message', messageHandler);

            if (message.code === '0' || message.code === 0) {
              this.logger.info('🔐 WebSocket authentication successful');
              resolve();
            } else {
              this.logger.error('🔐 WebSocket authentication failed:', {
                code: message.code,
                msg: message.msg,
                data: message.data,
                fullMessage: JSON.stringify(message),
              });
              reject(
                new Error(
                  `Authentication failed: ${message.msg || `Code ${message.code}` || 'Unknown error'}`
                )
              );
            }
          }
        } catch (error) {
          this.logger.error('Error parsing auth response:', { error });
        }
      };

      this.ws?.on('message', messageHandler);
    });
  }

  /**
   * WebSocket close event handler
   */
  private onClose(): void {
    this.status = 'disconnected';
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
    this.logger.error('❌ Bitget User Data Stream error:', { error: error.message });

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
        return;
      }

      if (parsedMessage.event === 'subscribe') {
        this.logger.info('✅ Private subscription confirmed:', { arg: parsedMessage.arg });
        return;
      }

      if (parsedMessage.event === 'login') {
        return;
      }

      if (parsedMessage.data && parsedMessage.arg) {
        this.processPrivateChannelData(parsedMessage);
      }
    } catch (error) {
      this.logger.error('❌ Error processing private message:', {
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
      const { arg, data } = message;

      if (!arg || !data) {
        this.logger.warn('⚠️ Invalid private message format:', { arg, hasData: !!data });
        return;
      }

      if (arg.channel === 'orders') {
        this.handleOrderUpdates(data);
      } else if (arg.channel === 'fill') {
        this.handleFillUpdates(data);
      } else if (arg.channel === 'account') {
        this.handleAccountUpdates(data);
      }
    } catch (error) {
      this.logger.error('❌ Error processing private channel data:', { error, message });
    }
  }

  /**
   * Handle order status updates
   */
  private handleOrderUpdates(data: any[]): void {
    try {
      if (!Array.isArray(data) || data.length === 0) return;

      data.forEach(orderData => {
        const order = this.dataMapper.mapOrder(orderData);

        this.subscriptions.forEach(subscription => {
          if (subscription.type === 'orders') {
            subscription.callback(order);
          }
        });
      });
    } catch (error) {
      this.logger.error('❌ Error handling order updates:', { error, data });
    }
  }

  /**
   * Handle trade execution (fill) updates
   */
  private handleFillUpdates(data: any[]): void {
    try {
      if (!Array.isArray(data) || data.length === 0) return;

      data.forEach(fillData => {
        const trade = this.dataMapper.mapTrade(fillData, fillData.instId || '');

        this.subscriptions.forEach(subscription => {
          if (subscription.type === 'user_trades') {
            subscription.callback(trade);
          }
        });
      });
    } catch (error) {
      this.logger.error('❌ Error handling fill updates:', { error, data });
    }
  }

  /**
   * Handle account balance updates
   */
  private handleAccountUpdates(data: any[]): void {
    try {
      if (!Array.isArray(data) || data.length === 0) return;

      data.forEach(accountData => {
        this.logger.info('💰 Account update received:', { accountData });

        this.subscriptions.forEach(subscription => {
          if (subscription.type === 'account') {
            subscription.callback(accountData);
          }
        });
      });
    } catch (error) {
      this.logger.error('❌ Error handling account updates:', { error, data });
    }
  }

  /**
   * Subscribe to real-time order updates
   *
   * @param callback - Function called when user's order status changes
   * @param symbol - Optional trading pair symbol (e.g., 'SNEK/USDT'). If not provided, subscribes to all symbols
   * @returns Promise resolving to subscription ID
   */
  async subscribeUserOrders(callback: (order: Order) => void, symbol?: string): Promise<string> {
    const instId = symbol ? toExchangeFormat(symbol) : 'default';
    const subscriptionId = `orders_${instId}_${Date.now()}`;

    this.subscriptions.set(subscriptionId, {
      callback,
      type: 'orders',
    } as BitgetSubscriptionInfo);

    await this.subscribe({
      op: 'subscribe',
      args: [
        {
          instType: 'SPOT',
          channel: 'orders',
          instId,
        },
      ],
    });

    const symbolText = symbol ? ` for ${symbol} (${instId})` : ' for all symbols';
    this.logger.info(`📋 Subscribed to user orders${symbolText}`);
    return subscriptionId;
  }

  /**
   * Subscribe to real-time trade execution updates
   *
   * @param callback - Function called when user's trades are executed
   * @param symbol - Optional trading pair symbol (e.g., 'SNEK/USDT'). If not provided, subscribes to all symbols
   * @returns Promise resolving to subscription ID
   */
  async subscribeUserTrades(callback: (trade: Trade) => void, symbol?: string): Promise<string> {
    const instId = symbol ? toExchangeFormat(symbol) : 'default';
    const subscriptionId = `user_trades_${instId}_${Date.now()}`;

    this.subscriptions.set(subscriptionId, {
      callback,
      type: 'user_trades',
    } as BitgetSubscriptionInfo);

    await this.subscribe({
      op: 'subscribe',
      args: [
        {
          instType: 'SPOT',
          channel: 'fill',
          instId,
        },
      ],
    });

    const symbolText = symbol ? ` for ${symbol} (${instId})` : ' for all symbols';
    this.logger.info(`💸 Subscribed to user trades (fills)${symbolText}`);
    return subscriptionId;
  }

  /**
   * Subscribe to account balance updates
   *
   * @param callback - Function called when account balance changes
   * @returns Promise resolving to subscription ID
   */
  async subscribeAccountUpdates(callback: (accountData: any) => void): Promise<string> {
    const subscriptionId = `account_${Date.now()}`;

    this.subscriptions.set(subscriptionId, {
      callback,
      type: 'account',
    } as BitgetSubscriptionInfo);

    await this.subscribe({
      op: 'subscribe',
      args: [
        {
          instType: 'SPOT',
          channel: 'account',
          coin: 'default', // Subscribe to all coins
        },
      ],
    });

    this.logger.info(`💰 Subscribed to account updates`);
    return subscriptionId;
  }

  /**
   * Send subscription/trading message
   */
  private async subscribe(message: any): Promise<void> {
    if (this.status !== 'connected' || !this.ws) {
      throw new Error('User Data Stream not connected');
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    this.logger.info(
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

    this.logger.info(`🔄 Resubscribing to ${this.subscriptions.size} private subscriptions`);

    for (const [id, subscription] of this.subscriptions) {
      try {
        if (subscription.type === 'orders') {
          await this.subscribe({
            op: 'subscribe',
            args: [
              {
                instType: 'SPOT',
                channel: 'orders',
                instId: 'default',
              },
            ],
          });
        } else if (subscription.type === 'user_trades') {
          await this.subscribe({
            op: 'subscribe',
            args: [
              {
                instType: 'SPOT',
                channel: 'fill',
                instId: 'default',
              },
            ],
          });
        } else if (subscription.type === 'account') {
          await this.subscribe({
            op: 'subscribe',
            args: [
              {
                instType: 'SPOT',
                channel: 'account',
                coin: 'default',
              },
            ],
          });
        }
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
        this.ws.send(JSON.stringify({ op: 'ping' }));
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

    this.logger.info('🔌 Bitget User Data Stream disconnected');
  }

  /**
   * Check if user data stream is connected
   */
  isUserDataStreamConnected(): boolean {
    return this.status === 'connected';
  }
}
