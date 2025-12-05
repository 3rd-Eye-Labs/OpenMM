import crypto from 'crypto';
import { MexcAuth } from '../../../../exchanges/mexc/mexc-auth';
import { ExchangeCredentials } from '../../../../types';
import { createLogger } from '../../../../utils';

jest.mock('../../../../utils');
jest.mock('crypto');

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

const MockedCreateLogger = createLogger as jest.MockedFunction<typeof createLogger>;
const MockedCrypto = crypto as jest.Mocked<typeof crypto>;

describe('MexcAuth', () => {
  let auth: MexcAuth;
  let mockCredentials: ExchangeCredentials;
  let mockLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCredentials = {
      apiKey: 'test-api-key',
      secret: 'test-secret-key'
    };

    mockLogger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    MockedCreateLogger.mockReturnValue(mockLogger);

    const mockHmac = {
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('mocked-signature')
    };
    MockedCrypto.createHmac.mockReturnValue(mockHmac as any);

    auth = new MexcAuth(mockCredentials);
  });

  describe('constructor', () => {
    it('should initialize with provided credentials and default base URL', () => {
      expect(auth).toBeInstanceOf(MexcAuth);
      expect(MockedCreateLogger).toHaveBeenCalledWith('mexc-auth');
    });

    it('should initialize with custom base URL', () => {
      const customBaseUrl = 'https://api.custom.mexc.com/api/v3';
      const customAuth = new MexcAuth(mockCredentials, customBaseUrl);
      
      expect(customAuth).toBeInstanceOf(MexcAuth);
    });
  });

  describe('createPublicHeaders()', () => {
    it('should create headers for public endpoints', () => {
      const headers = auth.createPublicHeaders();

      expect(headers).toEqual({
        'x-mexc-apikey': 'test-api-key',
        'Content-Type': 'application/json'
      });
    });

    it('should include API key from credentials', () => {
      const customCredentials: ExchangeCredentials = {
        apiKey: 'custom-api-key',
        secret: 'custom-secret'
      };
      const customAuth = new MexcAuth(customCredentials);

      const headers = customAuth.createPublicHeaders();

      expect(headers['x-mexc-apikey']).toBe('custom-api-key');
    });
  });

  describe('generateSignature()', () => {
    it('should generate HMAC-SHA256 signature', () => {
      const params = 'symbol=BTCUSDT&side=BUY&type=LIMIT';
      
      const signature = (auth as any).generateSignature(params);

      expect(MockedCrypto.createHmac).toHaveBeenCalledWith('sha256', 'test-secret-key');
      expect(signature).toBe('mocked-signature');
    });

    it('should use correct secret key for signature generation', () => {
      const customCredentials: ExchangeCredentials = {
        apiKey: 'api-key',
        secret: 'different-secret'
      };
      const customAuth = new MexcAuth(customCredentials);
      
      (customAuth as any).generateSignature('test-params');

      expect(MockedCrypto.createHmac).toHaveBeenCalledWith('sha256', 'different-secret');
    });

    it('should handle empty parameters', () => {
      const signature = (auth as any).generateSignature('');

      expect(signature).toBe('mocked-signature');
    });

    it('should handle special characters in parameters', () => {
      const params = 'symbol=BTC/USDT&data=special%20chars!@#$%^&*()';
      
      const signature = (auth as any).generateSignature(params);

      expect(signature).toBe('mocked-signature');
    });
  });

  describe('makeRequest()', () => {
    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(1640995200000);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should make authenticated GET request successfully', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true })
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await auth.makeRequest('/account');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mexc.com/api/v3/account?timestamp=1640995200000&signature=mocked-signature',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-mexc-apikey': 'test-api-key',
            'X-MEXC-TIMESTAMP': '1640995200000',
            'X-MEXC-SIGNATURE': 'mocked-signature'
          },
          body: undefined
        }
      );
      expect(result).toEqual({ success: true });
    });

    it('should make authenticated POST request successfully', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ orderId: '12345' })
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const params = { symbol: 'BTCUSDT', side: 'BUY', type: 'LIMIT' };
      const result = await auth.makeRequest('/order', params, 'POST');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mexc.com/api/v3/order',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-mexc-apikey': 'test-api-key',
            'X-MEXC-TIMESTAMP': '1640995200000',
            'X-MEXC-SIGNATURE': 'mocked-signature'
          },
          body: 'symbol=BTCUSDT&side=BUY&type=LIMIT&timestamp=1640995200000&signature=mocked-signature'
        }
      );
      expect(result).toEqual({ orderId: '12345' });
    });

    it('should handle PUT and DELETE requests', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true })
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await auth.makeRequest('/order/123', { status: 'cancelled' }, 'PUT');
      expect(mockFetch).toHaveBeenLastCalledWith(
        'https://api.mexc.com/api/v3/order/123',
        expect.objectContaining({ method: 'PUT' })
      );

      await auth.makeRequest('/order/123', {}, 'DELETE');
      expect(mockFetch).toHaveBeenLastCalledWith(
        'https://api.mexc.com/api/v3/order/123',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should add timestamp to parameters', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({})
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const params = { symbol: 'BTCUSDT' };
      await auth.makeRequest('/test', params);

      const expectedUrl = 'https://api.mexc.com/api/v3/test?symbol=BTCUSDT&timestamp=1640995200000&signature=mocked-signature';
      expect(mockFetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
    });

    it('should handle empty parameters', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({})
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await auth.makeRequest('/test');

      const expectedUrl = 'https://api.mexc.com/api/v3/test?timestamp=1640995200000&signature=mocked-signature';
      expect(mockFetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
    });

    it('should handle HTTP error responses', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue('Bad Request')
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(auth.makeRequest('/account')).rejects.toThrow('HTTP 400: Bad Request');
      expect(mockLogger.error).toHaveBeenCalledWith('MEXC API request failed', {
        endpoint: '/account',
        status: 400,
        error: 'HTTP 400: Bad Request'
      });
    });

    it('should handle MEXC API error responses with JSON format', async () => {
      const errorResponse = {
        code: 1001,
        msg: 'Invalid symbol'
      };
      const mockResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue(JSON.stringify(errorResponse))
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(auth.makeRequest('/account')).rejects.toThrow('MEXC API Error: Invalid symbol (Code: 1001)');
    });

    it('should handle MEXC API error responses without error code', async () => {
      const errorResponse = {
        msg: 'Rate limit exceeded'
      };
      const mockResponse = {
        ok: false,
        status: 429,
        text: jest.fn().mockResolvedValue(JSON.stringify(errorResponse))
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(auth.makeRequest('/account')).rejects.toThrow('MEXC API Error: Rate limit exceeded (Code: Unknown)');
    });

    it('should handle malformed JSON error responses', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Invalid JSON {')
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(auth.makeRequest('/account')).rejects.toThrow('HTTP 500: Invalid JSON {');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(auth.makeRequest('/account')).rejects.toThrow('Network error');
    });

    it('should create proper query string from parameters', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({})
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const params = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: 1.5,
        price: 50000
      };
      await auth.makeRequest('/order', params);

      const mockHmacCall = MockedCrypto.createHmac.mock.results[0].value;
      expect(mockHmacCall.update).toHaveBeenCalledWith(
        'symbol=BTCUSDT&side=BUY&quantity=1.5&price=50000&timestamp=1640995200000'
      );
    });
  });

  describe('makePublicRequest()', () => {
    it('should make public GET request successfully', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue([{ symbol: 'BTCUSDT', price: '50000' }])
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await auth.makePublicRequest('/ticker/price');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mexc.com/api/v3/ticker/price',
        {
          headers: {
            'x-mexc-apikey': 'test-api-key',
            'Content-Type': 'application/json'
          }
        }
      );
      expect(result).toEqual([{ symbol: 'BTCUSDT', price: '50000' }]);
    });

    it('should include query parameters in URL', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({})
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const params = { symbol: 'BTCUSDT', limit: 100 };
      await auth.makePublicRequest('/depth', params);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mexc.com/api/v3/depth?symbol=BTCUSDT&limit=100',
        expect.any(Object)
      );
    });

    it('should handle empty parameters', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({})
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await auth.makePublicRequest('/exchangeInfo');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mexc.com/api/v3/exchangeInfo',
        expect.any(Object)
      );
    });

    it('should handle HTTP error responses', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue('Not Found')
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(auth.makePublicRequest('/invalid')).rejects.toThrow('HTTP 404: Not Found');
    });

    it('should use public headers', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({})
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await auth.makePublicRequest('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        {
          headers: {
            'x-mexc-apikey': 'test-api-key',
            'Content-Type': 'application/json'
          }
        }
      );
    });

    it('should handle special characters in parameters', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({})
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const params = { search: 'BTC/USDT', filter: 'active&verified' };
      await auth.makePublicRequest('/symbols', params);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mexc.com/api/v3/symbols?search=BTC/USDT&filter=active&verified',
        expect.any(Object)
      );
    });
  });

  describe('validateCredentials()', () => {
    it('should return true for valid credentials', () => {
      const validCredentials: ExchangeCredentials = {
        apiKey: 'valid-api-key',
        secret: 'valid-secret-key'
      };
      const validAuth = new MexcAuth(validCredentials);

      expect(validAuth.validateCredentials()).toBe(true);
    });

    it('should return false for missing API key', () => {
      const invalidCredentials: ExchangeCredentials = {
        apiKey: '',
        secret: 'valid-secret-key'
      };
      const invalidAuth = new MexcAuth(invalidCredentials);

      expect(invalidAuth.validateCredentials()).toBe(false);
    });

    it('should return false for missing secret', () => {
      const invalidCredentials: ExchangeCredentials = {
        apiKey: 'valid-api-key',
        secret: ''
      };
      const invalidAuth = new MexcAuth(invalidCredentials);

      expect(invalidAuth.validateCredentials()).toBe(false);
    });

    it('should return false for both missing', () => {
      const invalidCredentials: ExchangeCredentials = {
        apiKey: '',
        secret: ''
      };
      const invalidAuth = new MexcAuth(invalidCredentials);

      expect(invalidAuth.validateCredentials()).toBe(false);
    });

    it('should return false for undefined credentials', () => {
      const invalidCredentials: ExchangeCredentials = {
        apiKey: undefined as any,
        secret: undefined as any
      };
      const invalidAuth = new MexcAuth(invalidCredentials);

      expect(invalidAuth.validateCredentials()).toBe(false);
    });

    it('should return false for null credentials', () => {
      const invalidCredentials: ExchangeCredentials = {
        apiKey: null as any,
        secret: null as any
      };
      const invalidAuth = new MexcAuth(invalidCredentials);

      expect(invalidAuth.validateCredentials()).toBe(false);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle response parsing errors', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(auth.makeRequest('/account')).rejects.toThrow('Invalid JSON');
    });

    it('should handle fetch timeout', async () => {
      mockFetch.mockRejectedValue(new Error('Request timeout'));

      await expect(auth.makeRequest('/account')).rejects.toThrow('Request timeout');
    });

    it('should handle large parameter values', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({})
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const largeParams = {
        data: 'x'.repeat(10000),
        number: Number.MAX_SAFE_INTEGER
      };
      
      await expect(auth.makeRequest('/test', largeParams)).resolves.not.toThrow();
    });

    it('should handle non-string parameter values', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({})
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const mixedParams = {
        symbol: 'BTCUSDT',
        quantity: 1.5,
        active: true,
        tags: null,
        nested: { key: 'value' }
      };
      
      await expect(auth.makeRequest('/test', mixedParams)).resolves.not.toThrow();
    });

    it('should maintain timestamp precision', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({})
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      jest.spyOn(Date, 'now').mockReturnValue(1640995200123.456);

      await auth.makeRequest('/test');

      const urlCall = mockFetch.mock.calls[0][0] as string;
      expect(urlCall).toContain('timestamp=1640995200123');
    });

    it('should handle concurrent requests', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true })
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const promises = [
        auth.makeRequest('/account'),
        auth.makeRequest('/orders'),
        auth.makeRequest('/trades')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      results.forEach(result => {
        expect(result).toEqual({ success: true });
      });
    });
  });

  describe('private method access', () => {
    it('should access createPrivateHeaders method', () => {
      const timestamp = 1640995200000;
      const signature = 'test-signature';

      const headers = (auth as any).createPrivateHeaders(timestamp, signature);

      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'x-mexc-apikey': 'test-api-key',
        'X-MEXC-TIMESTAMP': '1640995200000',
        'X-MEXC-SIGNATURE': 'test-signature'
      });
    });

    it('should access handleResponse method with successful response', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: 'success' })
      };

      const result = await (auth as any).handleResponse(mockResponse, '/test');

      expect(result).toEqual({ data: 'success' });
    });
  });
});