/**
 * Public market-data access without credentials (QBT-688)
 *
 * getTicker / getOrderBook / getRecentTrades / getOHLCV hit unauthenticated
 * endpoints on every supported exchange, so they must work with no API keys
 * configured. These tests run with the credential env vars unset.
 */
import { MexcConnector } from '../../../exchanges/mexc/mexc-connector';
import { GateioConnector } from '../../../exchanges/gateio/gateio-connector';
import { BitgetConnector } from '../../../exchanges/bitget/bitget-connector';
import { KrakenConnector } from '../../../exchanges/kraken/kraken-connector';
import { BaseExchangeConnector } from '../../../core/exchange/base-exchange-connector';

jest.mock('../../../config/environment', () => ({
  __esModule: true,
  default: {
    // No exchange credentials configured at all. gateio/bitget/kraken are absent
    // entirely, which is what the real config does when their env vars are unset.
    mexc: { apiKey: '', secret: '', uid: '' },
    logLevel: 'error',
    nodeEnv: 'test',
  },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

/** Minimal always-OK fetch response; body shape is per-exchange. */
const okResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  json: jest.fn().mockResolvedValue(body),
});

describe('public market data without credentials (QBT-688)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe.each([
    ['MEXC', () => new MexcConnector()],
    ['Gate.io', () => new GateioConnector()],
    ['Bitget', () => new BitgetConnector()],
    ['Kraken', () => new KrakenConnector()],
  ])('%s', (_name, create) => {
    it('connectPublic() succeeds with no credentials configured', async () => {
      const connector = create();
      await expect(connector.connectPublic()).resolves.not.toThrow();
      expect(connector.isConnected()).toBe(true);
    });

    it('reports itself as unauthenticated after connectPublic()', async () => {
      const connector = create();
      await connector.connectPublic();
      expect(connector.isAuthenticated()).toBe(false);
    });

    it('sends no credential headers on public requests', async () => {
      const connector = create();
      await connector.connectPublic();
      mockFetch.mockResolvedValue(okResponse({}) as any);

      // The response shape won't satisfy every mapper, but the request must
      // still go out unauthenticated — that is what we assert here.
      await connector.getTicker('BTC/USDT').catch(() => undefined);

      expect(mockFetch).toHaveBeenCalled();
      const init = mockFetch.mock.calls[0][1] ?? {};
      const headers = (init.headers ?? {}) as Record<string, string>;
      const headerKeys = Object.keys(headers).map(k => k.toLowerCase());

      expect(headerKeys).not.toContain('x-mexc-apikey');
      expect(headerKeys).not.toContain('key');
      expect(headerKeys).not.toContain('access-key');
      expect(headerKeys).not.toContain('api-key');
      expect(headerKeys).not.toContain('sign');
      expect(headerKeys).not.toContain('signature');
      expect(headerKeys).not.toContain('access-sign');
    });

    it.each(['getTicker', 'getOrderBook', 'getRecentTrades', 'getOHLCV'] as const)(
      '%s reaches the network rather than failing an auth gate',
      async method => {
        const connector = create();
        await connector.connectPublic();
        mockFetch.mockResolvedValue(okResponse({}) as any);

        const call =
          method === 'getOHLCV'
            ? connector.getOHLCV('BTC/USDT', '1h', 10)
            : (connector[method] as (s: string) => Promise<unknown>)('BTC/USDT');

        // Mapping the empty mock body may well throw; the point is that the
        // call was not rejected up-front for missing credentials.
        await call.catch((error: Error) => {
          expect(error.message).not.toMatch(/not authenticated/i);
          expect(error.message).not.toMatch(/credentials/i);
        });

        expect(mockFetch).toHaveBeenCalled();
      }
    );

    it('rejects authenticated operations with an actionable error', async () => {
      const connector = create();
      await connector.connectPublic();

      await expect(connector.getBalance()).rejects.toThrow();
    });
  });

  describe('BaseExchangeConnector defaults', () => {
    class BareConnector extends BaseExchangeConnector {
      constructor() {
        super('bare', 'Bare');
      }
      async connect(): Promise<void> {
        this.connected = true;
      }
      async disconnect(): Promise<void> {
        this.connected = false;
      }
      // Unused abstract members for this test.
      getBalance = jest.fn() as any;
      createOrder = jest.fn() as any;
      cancelOrder = jest.fn() as any;
      cancelAllOrders = jest.fn() as any;
      getOrder = jest.fn() as any;
      getOpenOrders = jest.fn() as any;
      getTicker = jest.fn() as any;
      getOrderBook = jest.fn() as any;
      getRecentTrades = jest.fn() as any;
      getOHLCV = jest.fn() as any;
      connectWebSocket = jest.fn() as any;
      disconnectWebSocket = jest.fn() as any;
      subscribeTicker = jest.fn() as any;
      subscribeOrderBook = jest.fn() as any;
      subscribeTrades = jest.fn() as any;
      subscribeOrders = jest.fn() as any;
      unsubscribe = jest.fn() as any;
      isWebSocketConnected = jest.fn() as any;
      getWebSocketStatus = jest.fn() as any;
      connectUserDataStream = jest.fn() as any;
      disconnectUserDataStream = jest.fn() as any;
      subscribeUserOrders = jest.fn() as any;
      subscribeUserTrades = jest.fn() as any;
      isUserDataStreamConnected = jest.fn() as any;
    }

    it('connectPublic() is concrete, so existing subclasses keep compiling', async () => {
      const connector = new BareConnector();
      await connector.connectPublic();
      expect(connector.isConnected()).toBe(true);
      expect(connector.isAuthenticated()).toBe(false);
    });

    it('connect() still marks the connector as authenticated', async () => {
      const connector = new BareConnector();
      await connector.connect();
      expect(connector.isAuthenticated()).toBe(true);
    });
  });
});
