import WebSocket from 'ws';
import { Order, OrderBook, Ticker, Trade, WebSocketStatus, DecodedMexcMessage, DecodedMexcOrder, DecodedMexcTickerData, DecodedMexcTradesData, MexcSubscription, SubscriptionInfo } from '../../types';
import { MexcProtobufDecoder } from './mexc-protobuf-decoder';
import { MexcUtils } from './mexc-utils';
import { createLogger } from '../../utils';

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

  constructor(wsUrl: string = 'wss://wbs-api.mexc.com/ws') {
    this.wsUrl = wsUrl;
  }

  /**
   * Connect to MEXC WebSocket
   */
  async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);
        this.status = 'connecting';

        this.ws.on('open', () => {
          this.status = 'connected';
          this.logger.info('WebSocket connected successfully');
          resolve();
        });

        this.ws.on('message', (data: Buffer) => {
          this.onMessage(data);
        });

        this.ws.on('close', () => {
          this.status = 'disconnected';
          this.logger.warn('WebSocket connection closed');
        });

        this.ws.on('error', (error) => {
          this.status = 'error';
          this.logger.error('WebSocket error:', { error });
          reject(error);
        });

      } catch (error) {
        this.status = 'error';
        reject(error);
      }
    });
  }

  /**
   * Message handler
   */
  private onMessage(data: Buffer): void {
    try {
      const message = data.toString();
      
      if (!message.includes('spot@')) {
        return;
      }

      // Decode protobuf message
      const decoded: DecodedMexcMessage = MexcProtobufDecoder.decode(message);
      
      if (decoded.error) {
        this.logger.warn('Protobuf decode error:', { error: decoded.error });
        return;
      }

      this.processDecodedMessage(decoded);

    } catch (error) {
      this.logger.error('Message handling error:', { error });
    }
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
      const order = MexcUtils.transformProtobufOrder(decoded.decoded as DecodedMexcOrder);
      
      this.subscriptions.forEach((subscription) => {
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
        symbol: MexcUtils.formatSymbol(decoded.symbol),
        last: parseFloat(tickerData.askprice || '0'),
        bid: parseFloat(tickerData.bidprice || '0'),
        ask: parseFloat(tickerData.askprice || '0'),
        baseVolume: parseFloat(tickerData.bidquantity || '0') + parseFloat(tickerData.askquantity || '0'),
        timestamp: Date.now()
      };

      this.subscriptions.forEach((subscription) => {
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
        tradesData.dealsList.forEach((deal) => {

          const trade: Trade = {
            id: `${Date.now()}_${Math.random()}`,
            symbol: MexcUtils.formatSymbol(decoded.symbol!),
            side: deal.tradetype === 1 ? 'buy' : 'sell',
            amount: parseFloat(deal.quantity || '0'),
            price: parseFloat(deal.price || '0'),
            timestamp: parseInt(deal.time) || Date.now()
          };

          this.subscriptions.forEach((subscription) => {
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
        symbol: MexcUtils.formatSymbol(decoded.symbol),
        bids: [{
          price: parseFloat(tickerData.bidprice || '0'),
          amount: parseFloat(tickerData.bidquantity || '0')
        }],
        asks: [{
          price: parseFloat(tickerData.askprice || '0'),
          amount: parseFloat(tickerData.askquantity || '0')
        }],
        timestamp: Date.now()
      };

      this.subscriptions.forEach((subscription) => {
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
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
      this.status = 'disconnected';
      this.subscriptions.clear();
    }
  }

  /**
   * Subscribe to ticker updates 
   */
  async subscribeTicker(symbol: string, callback: (ticker: Ticker) => void): Promise<string> {
    const mexcSymbol = MexcUtils.toMexcSymbol(symbol);
    const channel = `spot@public.aggre.bookTicker.v3.api.pb@100ms@${mexcSymbol}`;
    const subscriptionId = `ticker_${mexcSymbol}_${Date.now()}`;

    this.subscriptions.set(subscriptionId, {
      callback,
      type: 'ticker'
    });

    await this.subscribe([channel]);
    this.logger.info(`Subscribed to ticker: ${symbol} (${channel})`);
    
    return subscriptionId;
  }

  /**
   * Subscribe to trades updates 
   */
  async subscribeTrades(symbol: string, callback: (trade: Trade) => void): Promise<string> {
    const mexcSymbol = MexcUtils.toMexcSymbol(symbol);
    const channel = `spot@public.aggre.deals.v3.api.pb@100ms@${mexcSymbol}`;
    const subscriptionId = `trades_${mexcSymbol}_${Date.now()}`;

    this.subscriptions.set(subscriptionId, {
      callback,
      type: 'trades'
    });

    await this.subscribe([channel]);
    this.logger.info(`Subscribed to trades: ${symbol} (${channel})`);
    
    return subscriptionId;
  }

  /**
   * Subscribe to order book updates 
   */
  async subscribeOrderBook(symbol: string, callback: (orderbook: OrderBook) => void): Promise<string> {
    const mexcSymbol = MexcUtils.toMexcSymbol(symbol);
    const channel = `spot@public.bookTicker.batch.v3.api.pb@${mexcSymbol}`;
    const subscriptionId = `orderbook_${mexcSymbol}_${Date.now()}`;

    this.subscriptions.set(subscriptionId, {
      callback,
      type: 'orderbook'
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
      type: 'user_data'
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
      type: 'user_data'
    });
    
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
      params: channels
    };

    this.ws?.send(JSON.stringify(message));
    this.logger.debug('Sent subscription:', message);
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
}