import WebSocket from 'ws';
import {
  Order,
  OrderBook,
  Ticker,
  Trade,
  WebSocketStatus,
  DecodedMexcMessage,
  DecodedMexcOrder,
  DecodedMexcTickerData,
  DecodedMexcTradesData,
  MexcSubscription,
  SubscriptionInfo,
  OrderType,
  OrderSide,
} from '../../types';
import { MexcProtobufDecoder } from './mexc-protobuf-decoder';
import { MexcUtils } from './mexc-utils';
import { MexcDataMapper } from './mexc-data-mapper';
import { createLogger } from '../../utils';
import { toStandardFormat, toExchangeFormat } from '../../utils/symbol-utils';

/**
 * MEXC WebSocket
 *
 * Provides real-time market data streaming and user order updates
 */

export class MexcWebSocket {
  private ws?: WebSocket;
  private subscriptions = new Map<string, SubscriptionInfo>();
  private status: WebSocketStatus = 'disconnected';
  private readonly wsUrl: string;
  private logger = createLogger('mexc-websocket');
  private reconnectTimer?: NodeJS.Timeout;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;
  private autoReconnect = true;

  constructor(wsUrl: string = 'wss://wbs-api.mexc.com/ws') {
    this.wsUrl = wsUrl;
  }

  /**
   * Connect to MEXC WebSocket
   */
  async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.autoReconnect = true;
        this.ws = new WebSocket(this.wsUrl);
        this.status = 'connecting';

        this.ws.on('open', () => this.onOpen(resolve));

        this.ws.on('message', (data: Buffer) => {
          this.onMessage(data);
        });

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
    this.logger.info('✅ WebSocket connected successfully');
    resolve();
  }

  /**
   * WebSocket close event handler
   */
  private onClose(): void {
    this.status = 'disconnected';

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
    this.logger.error('❌ WebSocket error:', { error: error.message });

    if (this.reconnectAttempts === 0 && reject) {
      reject(error);
    }
  }

  /**
   * Message handler
   */
  private onMessage(data: Buffer): void {
    try {
      const message = data.toString();

      if (message.includes('spot@')) {
        if (message.includes('spot@private.orders.v3.api.pb')) {
          this.handleProtobufUserDataMessage(message);
        } else {
          const decoded: DecodedMexcMessage = MexcProtobufDecoder.decode(message);

          if (decoded.error) {
            this.logger.warn('Protobuf decode error:', { error: decoded.error });
            return;
          }

          this.processDecodedMessage(decoded);
        }
      } else {
        this.handleUserDataMessage(message);
      }
    } catch (error) {
      this.logger.error('Message handling error:', { error });
    }
  }

  /**
   * Handle protobuf user data stream messages
   */
  private handleProtobufUserDataMessage(message: string): void {
    try {
      const decoded: DecodedMexcMessage = MexcProtobufDecoder.decode(message);

      if (decoded.error) {
        this.logger.warn('Protobuf user data decode error:', { error: decoded.error });
        return;
      }

      if (decoded.type === 'order' && decoded.decoded) {
        const order = MexcUtils.transformOrder(decoded.decoded as DecodedMexcOrder);

        this.subscriptions.forEach(subscription => {
          if (subscription.type === 'user_data') {
            subscription.callback(order);
          }
        });
      } else {
        this.logger.info('📨 Non-order protobuf user data:', { type: decoded.type });
      }
    } catch (error) {
      this.logger.error('Error handling protobuf user data message:', {
        error,
        message: message.substring(0, 100),
      });
    }
  }

  /**
   * Handle user data stream messages
   */
  private handleUserDataMessage(message: string): void {
    try {
      const data = JSON.parse(message);

      if (data.e === 'executionReport') {
        const order = this.transformUserOrderUpdate(data);
        this.logger.info('📦 Order update received:', {
          orderId: order.id,
          status: order.status,
          symbol: order.symbol,
        });

        this.subscriptions.forEach(subscription => {
          if (subscription.type === 'user_data') {
            subscription.callback(order);
          }
        });
      } else {
        this.logger.info('📨 Non-execution report message:', { eventType: data.e, data });
      }
    } catch (error) {
      this.logger.error('Error handling user data message:', {
        error,
        message: message.substring(0, 100),
      });
    }
  }

  /**
   * Transform MEXC user data order update to Order format
   */
  private transformUserOrderUpdate(data: any): Order {
    return {
      id: data.i?.toString() || data.orderId?.toString() || Date.now().toString(),
      symbol: (() => {
        const mexcSymbol = data.s || data.symbol || '';
        try {
          return toStandardFormat(mexcSymbol);
        } catch {
          return mexcSymbol;
        }
      })(),
      type: (data.o?.toLowerCase() || 'limit') as OrderType,
      side: (data.S?.toLowerCase() || 'buy') as OrderSide,
      amount: parseFloat(data.q || data.origQty || '0'),
      price: parseFloat(data.p || data.price || '0'),
      filled: parseFloat(data.z || data.executedQty || '0'),
      remaining: parseFloat(data.q || '0') - parseFloat(data.z || '0'),
      status: MexcDataMapper.mapToOrderStatus(data.X || data.orderStatus || 'NEW'),
      timestamp: parseInt(data.T || data.transactTime) || Date.now(),
    };
  }

  /**
   * Process decoded message directly based on type
   */
  private processDecodedMessage(decoded: DecodedMexcMessage): void {
    switch (decoded.type) {
      case 'order':
        this.onOrderUpdate(decoded);
        break;
      case 'ticker':
        this.onTickerUpdate(decoded);
        this.onOrderBookUpdate(decoded);
        break;
      case 'trades':
        this.onTradesUpdate(decoded);
        break;
      default:
        this.logger.debug(`Unhandled message type: ${decoded.type}`);
    }
  }

  /**
   * Handle order updates directly from protobuf
   */
  private onOrderUpdate(decoded: DecodedMexcMessage): void {
    if (!decoded.decoded || !decoded.symbol || decoded.type !== 'order') return;

    try {
      const order = MexcUtils.transformOrder(decoded.decoded);

      this.subscriptions.forEach(subscription => {
        if (subscription.type === 'user_data') {
          subscription.callback(order);
        }
      });
    } catch (error) {
      this.logger.error('Error processing order update:', { error });
    }
  }

  /**
   * Handle ticker updates directly from protobuf
   */
  private onTickerUpdate(decoded: DecodedMexcMessage): void {
    if (!decoded.decoded || !decoded.symbol || decoded.type !== 'ticker') return;

    try {
      const tickerData = decoded.decoded as DecodedMexcTickerData;

      const ticker: Ticker = {
        symbol: (() => {
          try {
            return toStandardFormat(decoded.symbol);
          } catch {
            return decoded.symbol;
          }
        })(),
        last: parseFloat(tickerData.askprice || '0'),
        bid: parseFloat(tickerData.bidprice || '0'),
        ask: parseFloat(tickerData.askprice || '0'),
        baseVolume:
          parseFloat(tickerData.bidquantity || '0') + parseFloat(tickerData.askquantity || '0'),
        timestamp: Date.now(),
      };

      this.subscriptions.forEach(subscription => {
        if (subscription.type === 'ticker') {
          subscription.callback(ticker);
        }
      });
    } catch (error) {
      this.logger.error('Error processing ticker update:', { error });
    }
  }

  /**
   * Handle trades updates directly from protobuf
   */
  private onTradesUpdate(decoded: DecodedMexcMessage): void {
    if (!decoded.decoded || !decoded.symbol || decoded.type !== 'trades') return;

    try {
      const tradesData = decoded.decoded as DecodedMexcTradesData;

      if (tradesData.dealsList && Array.isArray(tradesData.dealsList)) {
        tradesData.dealsList.forEach(deal => {
          const trade: Trade = {
            id: `${Date.now()}_${Math.random()}`,
            symbol: (() => {
              try {
                return toStandardFormat(decoded.symbol!);
              } catch {
                return decoded.symbol!;
              }
            })(),
            side: deal.tradetype === 1 ? 'buy' : 'sell',
            amount: parseFloat(deal.quantity || '0'),
            price: parseFloat(deal.price || '0'),
            timestamp: parseInt(deal.time) || Date.now(),
          };

          this.subscriptions.forEach(subscription => {
            if (subscription.type === 'trades') {
              subscription.callback(trade);
            }
          });
        });
      }
    } catch (error) {
      this.logger.error('Error processing trades update:', { error });
    }
  }

  /**
   * Handle order book updates directly from protobuf
   */
  private onOrderBookUpdate(decoded: DecodedMexcMessage): void {
    if (!decoded.decoded || !decoded.symbol || decoded.type !== 'ticker') return;

    try {
      const tickerData = decoded.decoded as DecodedMexcTickerData;

      const orderBook: OrderBook = {
        symbol: (() => {
          try {
            return toStandardFormat(decoded.symbol);
          } catch {
            return decoded.symbol;
          }
        })(),
        bids: [
          {
            price: parseFloat(tickerData.bidprice || '0'),
            amount: parseFloat(tickerData.bidquantity || '0'),
          },
        ],
        asks: [
          {
            price: parseFloat(tickerData.askprice || '0'),
            amount: parseFloat(tickerData.askquantity || '0'),
          },
        ],
        timestamp: Date.now(),
      };

      this.subscriptions.forEach(subscription => {
        if (subscription.type === 'orderbook') {
          subscription.callback(orderBook);
        }
      });
    } catch (error) {
      this.logger.error('Error processing orderbook update:', { error });
    }
  }

  /**
   * Disconnect WebSocket
   */
  async disconnectWebSocket(): Promise<void> {
    this.autoReconnect = false;
    this.clearReconnectTimer();

    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
      this.status = 'disconnected';
      this.subscriptions.clear();
    }
    this.logger.info('🔌 WebSocket disconnected');
  }

  /**
   * Subscribe to ticker updates
   */
  async subscribeTicker(symbol: string, callback: (ticker: Ticker) => void): Promise<string> {
    const mexcSymbol = toExchangeFormat(symbol);
    const channel = `spot@public.aggre.bookTicker.v3.api.pb@100ms@${mexcSymbol}`;
    const subscriptionId = `ticker_${mexcSymbol}_${Date.now()}`;

    this.subscriptions.set(subscriptionId, {
      callback,
      type: 'ticker',
    });

    await this.subscribe([channel]);
    this.logger.info(`Subscribed to ticker: ${symbol} (${channel})`);

    return subscriptionId;
  }

  /**
   * Subscribe to trades updates
   */
  async subscribeTrades(symbol: string, callback: (trade: Trade) => void): Promise<string> {
    const mexcSymbol = toExchangeFormat(symbol);
    const channel = `spot@public.aggre.deals.v3.api.pb@100ms@${mexcSymbol}`;
    const subscriptionId = `trades_${mexcSymbol}_${Date.now()}`;

    this.subscriptions.set(subscriptionId, {
      callback,
      type: 'trades',
    });

    await this.subscribe([channel]);
    this.logger.info(`Subscribed to trades: ${symbol} (${channel})`);

    return subscriptionId;
  }

  /**
   * Subscribe to order book updates
   */
  async subscribeOrderBook(
    symbol: string,
    callback: (orderbook: OrderBook) => void
  ): Promise<string> {
    const mexcSymbol = toExchangeFormat(symbol);
    const channel = `spot@public.bookTicker.batch.v3.api.pb@${mexcSymbol}`;
    const subscriptionId = `orderbook_${mexcSymbol}_${Date.now()}`;

    this.subscriptions.set(subscriptionId, {
      callback,
      type: 'orderbook',
    });

    await this.subscribe([channel]);
    this.logger.info(`Subscribed to orderbook: ${symbol} (${channel})`);

    return subscriptionId;
  }

  /**
   * Subscribe to user orders
   */
  async subscribeOrders(callback: (order: Order) => void): Promise<string> {
    const subscriptionId = `orders_${Date.now()}`;

    this.subscriptions.set(subscriptionId, {
      callback,
      type: 'user_data',
    });

    this.logger.info('Subscribed to user orders (orders stream)');

    return subscriptionId;
  }

  /**
   * Subscribe to user data
   */
  async subscribeToUserData(callback: (order: Order) => void): Promise<string> {
    const subscriptionId = `user_data_${Date.now()}`;

    this.subscriptions.set(subscriptionId, {
      callback,
      type: 'user_data',
    });

    try {
      const userDataChannels = ['spot@private.orders.v3.api.pb'];

      await this.subscribe(userDataChannels);
    } catch (error) {
      this.logger.error('Failed to subscribe to protobuf user data channels:', { error });
    }

    return subscriptionId;
  }

  /**
   * Send subscription message to MEXC
   */
  private async subscribe(channels: string[]): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('WebSocket not connected');
    }

    const message: MexcSubscription = {
      method: 'SUBSCRIPTION',
      params: channels,
    };

    this.ws?.send(JSON.stringify(message));
  }

  /**
   * Unsubscribe from a subscription
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      this.logger.warn(`Subscription ${subscriptionId} not found`);
      return;
    }

    this.subscriptions.delete(subscriptionId);
    this.logger.info(`Unsubscribed: ${subscriptionId}`);
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.status === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get WebSocket status
   */
  getWebSocketStatus(): WebSocketStatus {
    return this.status;
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    this.reconnectTimer = setTimeout(() => {
      this.reconnect().catch(error => {
        this.logger.error('❌ Reconnection attempt failed:', { error });
      });
    }, delay);
  }

  /**
   * Attempt to reconnect
   */
  private async reconnect(): Promise<void> {
    try {
      await this.connectWebSocket();
      this.logger.info('✅ Reconnected successfully');
    } catch (error) {
      this.logger.error('❌ Reconnection failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Clear reconnection timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }
}
