import { MexcWebSocket } from './mexc-websocket';
import { Order, Trade } from '../../types';
import { createLogger } from '../../utils';


/**
 * Official MEXC User Stream Documentation:
 *
 * This user stream module provides:
 * - Real-time order updates (limit/market orders)
 * - Real-time trade executions (fills)
 * - Management of user data stream connection
 * - Keep-alive and listen key management
 *
 * https://www.mexc.com/api-docs/spot-v3/websocket-market-streams
 *
 */
/**
 * MEXC User Data Stream Manager
 * Handles user-specific data stream operations for real-time order updates
 */
export class MexcUserStream {
  private listenKey?: string;
  private userDataWs?: MexcWebSocket;
  private keepAliveInterval?: NodeJS.Timeout;
  private makeRequestFn: (endpoint: string, params: Record<string, unknown>, method: string) => Promise<any>;
  private logger = createLogger('mexc-user-stream');
  private orderCallback?: (order: Order) => void;
  private tradeCallback?: (trade: Trade) => void;

  constructor(makeRequestFn: (endpoint: string, params: Record<string, unknown>, method: string) => Promise<any>) {
    this.makeRequestFn = makeRequestFn;
  }

  /**
   * Connect to user data stream for real-time order updates
   */
  async connectUserDataStream(): Promise<void> {
    try {
      await this.getListenKey();
      
      if (!this.userDataWs) {
        const wsUrl = `wss://wbs-api.mexc.com/ws?listenKey=${this.listenKey}`;
        this.userDataWs = new MexcWebSocket(wsUrl);
      }

      await this.userDataWs.connectWebSocket();
      this.logger.info('✅ User data stream connected successfully');

      this.keepAliveInterval = setInterval(() => {
        this.keepAliveListenKey().catch((error) => this.logger.error('Keep alive listen key failed', { error }));
      }, 30 * 60 * 1000);

      this.setupDisconnectHandler();
      
      this.startConnectionMonitoring();

    } catch (error: unknown) {
      this.logger.error('❌ Failed to connect user data stream:', { error });
      throw new Error(`Failed to connect user data stream: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Set up immediate disconnect detection
   */
  private setupDisconnectHandler(): void {
    if (!this.userDataWs) return;
    
    const originalOnClose = (this.userDataWs as any).ws?.onclose;
    if ((this.userDataWs as any).ws) {
      (this.userDataWs as any).ws.onclose = (event: any) => {
        
        if (originalOnClose) {
          originalOnClose.call((this.userDataWs as any).ws, event);
        }
        
        setTimeout(() => {
          if (this.userDataWs && !this.userDataWs.isConnected()) {
            this.reconnectUserDataStream().catch((error) =>
              this.logger.error('Immediate reconnection failed:', { error })
            );
          }
        }, 1000);
      };
    }
  }

  /**
   * Monitor connection status and reconnect if needed
   */
  private startConnectionMonitoring(): void {
    setInterval(() => {
      if (this.userDataWs && !this.userDataWs.isConnected()) {
        this.reconnectUserDataStream().catch((error) =>
          this.logger.error('Failed to reconnect user data stream:', { error })
        );
      } else if (this.userDataWs) {
      } else {
        this.logger.warn('⚠️ No user data WebSocket instance found');
      }
    }, 10000);
  }

  /**
   * Reconnect the user data stream
   */
  private async reconnectUserDataStream(): Promise<void> {
    try {
      if (this.userDataWs) {
        await this.userDataWs.disconnectWebSocket();
        this.userDataWs = undefined;
      }

      await this.getListenKey();
      
      const wsUrl = `wss://wbs-api.mexc.com/ws?listenKey=${this.listenKey}`;
      this.userDataWs = new MexcWebSocket(wsUrl);
      
      await this.userDataWs.connectWebSocket();

      this.setupDisconnectHandler();
      
      if (this.orderCallback) {
        await this.userDataWs.subscribeToUserData(this.orderCallback);
      }
      
      if (this.tradeCallback) {
        const wrappedCallback = (data: any) => {
          if (this.isTradeExecution(data)) {
            const trade = this.transformToTrade(data);
            this.tradeCallback!(trade);
          }
        };
        await this.userDataWs.subscribeToUserData(wrappedCallback);
      }
      
    } catch (error) {
      this.logger.error('❌ Failed to reconnect user data stream:', { error });
      throw error;
    }
  }

  /**
   * Disconnect user data stream
   */
  async disconnectUserDataStream(): Promise<void> {
    try {
      if (this.keepAliveInterval) {
        clearInterval(this.keepAliveInterval);
        this.keepAliveInterval = undefined;
      }

      if (this.userDataWs) {
        await this.userDataWs.disconnectWebSocket();
        this.userDataWs = undefined;
      }

      await this.deleteListenKey();
    } catch (error: unknown) {
      this.logger.warn('Error during user data stream disconnect', { error });
    }
  }
  /**
   * Subscribe to real-time user order updates (limit/market orders)
   */
  async subscribeUserOrders(callback: (order: Order) => void): Promise<string> {
    try {
      if (!this.userDataWs) {
        throw new Error('User data stream not connected. Call connect() first.');
      }

      this.orderCallback = callback;

      return await this.userDataWs.subscribeToUserData(callback);
    } catch (error: unknown) {
      this.logger.error('❌ Failed to subscribe to user orders:', { error });
      throw new Error(`Failed to subscribe to user orders: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if user data stream is connected
   */
  isUserDataStreamConnected(): boolean {
    return this.userDataWs?.isConnected() || false;
  }

  /**
   * Subscribe to real-time user trade executions
   * Notifies when user's orders are filled/executed
   */
  async subscribeUserTrades(callback: (trade: Trade) => void): Promise<string> {
    try {
      if (!this.userDataWs) {
        throw new Error('User data stream not connected. Call connect() first.');
      }

      this.tradeCallback = callback;
      const wrappedCallback = (data: any) => {
        if (this.isTradeExecution(data)) {
          const trade = this.transformToTrade(data);
          callback(trade);
        }
      };

      return await this.userDataWs.subscribeToUserData(wrappedCallback);
    } catch (error: unknown) {
      throw new Error(`Failed to subscribe to user trades: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a listen key for user data stream
   */
  async getListenKey(): Promise<string> {
    try {
      const result = await this.makeRequestFn('/userDataStream', {}, 'POST');
      this.listenKey = result.listenKey;
      if (!this.listenKey) {
        throw new Error('No listen key received from API');
      }
      return this.listenKey;
    } catch (error: unknown) {
      throw new Error(`Failed to get listen key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Keep alive a user data stream
   */
  async keepAliveListenKey(): Promise<void> {
    if (!this.listenKey) return;
    
    try {
      await this.makeRequestFn('/userDataStream', { listenKey: this.listenKey }, 'PUT');
    } catch (error: unknown) {
      this.logger.warn('Failed to keep alive listen key', { error });
    }
  }

  /**
   * Delete a user data stream  
   */
  async deleteListenKey(): Promise<void> {
    if (!this.listenKey) return;
    
    try {
      await this.makeRequestFn('/userDataStream', { listenKey: this.listenKey }, 'DELETE');
      this.listenKey = undefined;
    } catch (error: unknown) {
      this.logger.warn('Failed to delete listen key', { error });
      this.listenKey = undefined;
    }
  }

  /**
   * Check if the data represents a trade execution event
   */
  private isTradeExecution(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }
    
    const isFilled = data.status === 'filled';
    const isPartiallyFilled = data.filled && data.filled > 0;
    const hasExecutedQuantity = data.amount && data.filled && (data.filled / data.amount) > 0;
    
    return isFilled || isPartiallyFilled || hasExecutedQuantity;
  }

  /**
   * Transform user data to Trade format for trade executions
   */
  private transformToTrade(data: any): Trade {
    return {
      id: data.tradeId || `${data.id}_${Date.now()}`,
      orderId: data.id,
      symbol: data.symbol,
      side: data.side,
      amount: parseFloat(data.filled || data.executedQty || '0'),
      price: parseFloat(data.price || '0'),
      fee: parseFloat(data.fee || '0'),
      timestamp: data.timestamp || Date.now()
    };
  }
}