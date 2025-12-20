import { MexcConnector } from '../../../../exchanges/mexc/mexc-connector';
import { MexcWebSocket } from '../../../../exchanges/mexc/mexc-websocket';
import { MexcUserStream } from '../../../../exchanges/mexc/mexc-user-stream';
import { Order, OrderType, OrderSide, Ticker, Trade, OrderBook } from '../../../../types';

const MEXC_TEST_CONFIG = {
  apiKey: process.env.MEXC_API_KEY || 'test_api_key',
  apiSecret: process.env.MEXC_API_SECRET || 'test_api_secret',
  testMode: !process.env.MEXC_API_KEY || process.env.NODE_ENV === 'test',
  testSymbol: 'INDY/USDT',
  altSymbol: 'BTC/USDT',
  timeout: 30000,
};

describe('MEXC Integration Tests', () => {
  let mexcConnector: MexcConnector;
  let mexcWebSocket: MexcWebSocket;
  let mexcUserStream: MexcUserStream;

  const cleanup = async () => {
    try {
      if (mexcWebSocket?.isConnected()) {
        await mexcWebSocket.disconnectWebSocket();
      }
      if (mexcUserStream?.isUserDataStreamConnected()) {
        await mexcUserStream.disconnectUserDataStream();
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  };

  beforeEach(() => {
    mexcConnector = new MexcConnector();
    mexcWebSocket = new MexcWebSocket();
    mexcUserStream = new MexcUserStream(
      (_endpoint: string, _params: Record<string, unknown>, _method: string) => Promise.resolve({})
    );

    if (!MEXC_TEST_CONFIG.testMode) {
      mexcConnector.setCredentials({
        apiKey: MEXC_TEST_CONFIG.apiKey,
        secret: MEXC_TEST_CONFIG.apiSecret,
      });
    }
  });

  afterEach(cleanup);
  afterAll(cleanup);

  describe('MEXC Trading Workflow Integration', () => {
    test(
      'Complete order lifecycle: connect → create → monitor → cancel',
      async () => {
        if (MEXC_TEST_CONFIG.testMode) {
          return;
        }

        const orderUpdates: Order[] = [];
        let orderId: string = '';

        try {
          await mexcConnector.connect();
          expect(mexcConnector.isConnected()).toBe(true);

          await mexcUserStream.connectUserDataStream();
          expect(mexcUserStream.isUserDataStreamConnected()).toBe(true);

          await mexcUserStream.subscribeUserOrders((order: Order) => {
            orderUpdates.push(order);
          });

          const balance = await mexcConnector.getBalance();
          expect(balance).toBeDefined();
          expect(typeof balance).toBe('object');

          const orderParams = {
            symbol: MEXC_TEST_CONFIG.testSymbol,
            type: 'limit' as OrderType,
            side: 'buy' as OrderSide,
            amount: 10,
            price: 0.01,
          };

          const createdOrder = await mexcConnector.createOrder(
            orderParams.symbol,
            orderParams.type,
            orderParams.side,
            orderParams.amount,
            orderParams.price
          );

          expect(createdOrder).toBeDefined();
          expect(createdOrder.id).toBeDefined();
          expect(createdOrder.symbol).toBe(orderParams.symbol);
          expect(createdOrder.side).toBe(orderParams.side);
          expect(createdOrder.status).toMatch(/open|pending/);

          orderId = createdOrder.id;

          await new Promise(resolve => setTimeout(resolve, 2000));

          const openOrders = await mexcConnector.getOpenOrders(orderParams.symbol);
          const foundOrder = openOrders.find((o: Order) => o.id === orderId);
          expect(foundOrder).toBeDefined();

          await new Promise(resolve => setTimeout(resolve, 3000));

          expect(orderUpdates.length).toBeGreaterThan(0);
          const relevantUpdate = orderUpdates.find(update => update.id === orderId);
          expect(relevantUpdate).toBeDefined();

          await mexcConnector.cancelOrder(orderId, orderParams.symbol);

          await new Promise(resolve => setTimeout(resolve, 2000));

          const finalOpenOrders = await mexcConnector.getOpenOrders(orderParams.symbol);
          const cancelledOrderStillOpen = finalOpenOrders.find((o: Order) => o.id === orderId);
          expect(cancelledOrderStillOpen).toBeUndefined();

          const cancellationUpdate = orderUpdates.find(
            update => update.id === orderId && update.status.match(/cancelled|canceled/)
          );
          expect(cancellationUpdate).toBeDefined();
        } catch (error) {
          if (orderId) {
            try {
              await mexcConnector.cancelOrder(orderId, MEXC_TEST_CONFIG.testSymbol);
            } catch (cleanupError) {
              // Ignore cleanup errors
            }
          }
          throw error;
        }
      },
      MEXC_TEST_CONFIG.timeout
    );
  });

  describe('MEXC Real-time Data Pipeline', () => {
    test(
      'Market data flow: connect → subscribe → receive → transform',
      async () => {
        const tickerData: Ticker[] = [];
        const tradeData: Trade[] = [];
        const orderbookData: OrderBook[] = [];

        try {
          await mexcWebSocket.connectWebSocket();
          expect(mexcWebSocket.isConnected()).toBe(true);

          const tickerSub = await mexcWebSocket.subscribeTicker(
            MEXC_TEST_CONFIG.testSymbol,
            (ticker: Ticker) => {
              tickerData.push(ticker);
            }
          );
          expect(tickerSub).toBeDefined();

          const tradesSub = await mexcWebSocket.subscribeTrades(
            MEXC_TEST_CONFIG.testSymbol,
            (trade: Trade) => {
              tradeData.push(trade);
            }
          );
          expect(tradesSub).toBeDefined();

          const orderbookSub = await mexcWebSocket.subscribeOrderBook(
            MEXC_TEST_CONFIG.testSymbol,
            (orderbook: OrderBook) => {
              orderbookData.push(orderbook);
            }
          );
          expect(orderbookSub).toBeDefined();

          await new Promise(resolve => setTimeout(resolve, 10000));

          expect(tickerData.length).toBeGreaterThan(0);
          expect(orderbookData.length).toBeGreaterThan(0);

          const latestTicker = tickerData[tickerData.length - 1];
          expect(latestTicker.symbol).toBe(MEXC_TEST_CONFIG.testSymbol);
          expect(latestTicker.last).toBeGreaterThan(0);
          expect(latestTicker.bid).toBeGreaterThan(0);
          expect(latestTicker.ask).toBeGreaterThan(0);
          expect(latestTicker.timestamp).toBeDefined();

          if (tradeData.length > 0) {
            const latestTrade = tradeData[tradeData.length - 1];
            expect(latestTrade.symbol).toBe(MEXC_TEST_CONFIG.testSymbol);
            expect(['buy', 'sell']).toContain(latestTrade.side);
            expect(latestTrade.amount).toBeGreaterThan(0);
            expect(latestTrade.price).toBeGreaterThan(0);
          }

          const latestOrderbook = orderbookData[orderbookData.length - 1];
          expect(latestOrderbook.symbol).toBe(MEXC_TEST_CONFIG.testSymbol);
          expect(latestOrderbook.bids.length).toBeGreaterThan(0);
          expect(latestOrderbook.asks.length).toBeGreaterThan(0);
          expect(latestOrderbook.bids[0].price).toBeGreaterThan(0);
          expect(latestOrderbook.asks[0].price).toBeGreaterThan(0);

          await mexcWebSocket.unsubscribe(tickerSub);
          await mexcWebSocket.unsubscribe(tradesSub);
          await mexcWebSocket.unsubscribe(orderbookSub);
        } catch (error) {
          throw error;
        }
      },
      MEXC_TEST_CONFIG.timeout
    );
  });

  describe('MEXC Authentication Integration', () => {
    test(
      'Auth flow: credentials → signing → authenticated requests → user streams',
      async () => {
        if (MEXC_TEST_CONFIG.testMode) {
          return;
        }

        try {
          await mexcConnector.connect();
          expect(mexcConnector.isConnected()).toBe(true);

          const balance = await mexcConnector.getBalance();
          expect(balance).toBeDefined();
          expect(typeof balance).toBe('object');

          const openOrders = await mexcConnector.getOpenOrders(MEXC_TEST_CONFIG.testSymbol);
          expect(Array.isArray(openOrders)).toBe(true);

          await mexcUserStream.connectUserDataStream();
          expect(mexcUserStream.isUserDataStreamConnected()).toBe(true);

          await mexcUserStream.keepAliveListenKey();
        } catch (error) {
          throw error;
        }
      },
      MEXC_TEST_CONFIG.timeout
    );
  });

  describe('MEXC Multi-Asset Trading', () => {
    test(
      'Multi-symbol operations: INDY/USDT + BTC/USDT workflows',
      async () => {
        const symbols = [MEXC_TEST_CONFIG.testSymbol, MEXC_TEST_CONFIG.altSymbol];
        const marketData = new Map<
          string,
          { tickers: Ticker[]; trades: Trade[]; orderbooks: OrderBook[] }
        >();

        symbols.forEach(symbol => {
          marketData.set(symbol, { tickers: [], trades: [], orderbooks: [] });
        });

        try {
          await mexcWebSocket.connectWebSocket();
          expect(mexcWebSocket.isConnected()).toBe(true);

          const subscriptions: string[] = [];

          for (const symbol of symbols) {
            const symbolData = marketData.get(symbol)!;

            const tickerSub = await mexcWebSocket.subscribeTicker(symbol, (ticker: Ticker) => {
              symbolData.tickers.push(ticker);
            });
            subscriptions.push(tickerSub);

            const tradesSub = await mexcWebSocket.subscribeTrades(symbol, (trade: Trade) => {
              symbolData.trades.push(trade);
            });
            subscriptions.push(tradesSub);

            const orderbookSub = await mexcWebSocket.subscribeOrderBook(
              symbol,
              (orderbook: OrderBook) => {
                symbolData.orderbooks.push(orderbook);
              }
            );
            subscriptions.push(orderbookSub);
          }

          await new Promise(resolve => setTimeout(resolve, 15000));

          for (const symbol of symbols) {
            const symbolData = marketData.get(symbol)!;

            expect(symbolData.tickers.length).toBeGreaterThan(0);
            expect(symbolData.orderbooks.length).toBeGreaterThan(0);

            const latestTicker = symbolData.tickers[symbolData.tickers.length - 1];
            expect(latestTicker.last).toBeGreaterThan(0);

            if (symbolData.trades.length > 0) {
              const latestTrade = symbolData.trades[symbolData.trades.length - 1];
              expect(['buy', 'sell']).toContain(latestTrade.side);
            }

            const latestOrderbook = symbolData.orderbooks[symbolData.orderbooks.length - 1];
            expect(latestOrderbook.bids.length).toBeGreaterThan(0);
            expect(latestOrderbook.asks.length).toBeGreaterThan(0);
          }

          if (!MEXC_TEST_CONFIG.testMode) {
            const balance = await mexcConnector.getBalance();
            expect(balance).toBeDefined();

            for (const symbol of symbols) {
              const openOrders = await mexcConnector.getOpenOrders(symbol);
              expect(Array.isArray(openOrders)).toBe(true);
            }
          }

          for (const subId of subscriptions) {
            await mexcWebSocket.unsubscribe(subId);
          }
        } catch (error) {
          throw error;
        }
      },
      MEXC_TEST_CONFIG.timeout
    );
  });
});
