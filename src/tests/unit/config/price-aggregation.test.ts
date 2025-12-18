import {
  CEX_API_CONFIG,
  IRIS_CONFIG,
  SUPPORTED_TOKENS,
  getTokenConfig,
  isTokenSupported,
  getSupportedTokens
} from '../../../config/price-aggregation';

describe('Price Aggregation Config', () => {
  describe('CEX_API_CONFIG', () => {
    it('should contain all expected exchanges with proper structure', () => {
      expect(CEX_API_CONFIG.BINANCE).toEqual({
        BASE_URL: 'https://api.binance.com/api/v3',
        ENDPOINTS: {
          TICKER_PRICE: '/ticker/price'
        }
      });

      expect(CEX_API_CONFIG.MEXC).toEqual({
        BASE_URL: 'https://api.mexc.com/api/v3',
        ENDPOINTS: {
          TICKER_PRICE: '/ticker/price'
        }
      });

      expect(CEX_API_CONFIG.COINGECKO).toEqual({
        BASE_URL: 'https://api.coingecko.com/api/v3',
        ENDPOINTS: {
          SIMPLE_PRICE: '/simple/price'
        }
      });

      expect(CEX_API_CONFIG.KRAKEN).toEqual({
        BASE_URL: 'https://api.kraken.com/0/public',
        ENDPOINTS: {
          TICKER: '/Ticker'
        }
      });
    });
  });

  describe('IRIS_CONFIG', () => {
    it('should contain correct Iris configuration', () => {
      expect(IRIS_CONFIG).toEqual({
        BASE_URL: 'https://iris.indigoprotocol.io',
        TIMEOUT: 10000
      });
    });
  });

  describe('SUPPORTED_TOKENS', () => {
    it('should contain expected token configurations', () => {
      expect(SUPPORTED_TOKENS.INDY).toEqual({
        symbol: 'INDY',
        policyId: '533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0',
        assetName: '494e4459',
        minLiquidityThreshold: 100000
      });

      expect(SUPPORTED_TOKENS.SNEK).toEqual({
        symbol: 'SNEK',
        policyId: '279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f',
        assetName: '534e454b',
        minLiquidityThreshold: 50000
      });

      expect(SUPPORTED_TOKENS.NIGHT).toEqual({
        symbol: 'NIGHT',
        policyId: '0691b2fecca1ac4f53cb6dfb00b7013e561d1f34403b957cbb5af1fa',
        assetName: '4e49474854',
        minLiquidityThreshold: 25000
      });

      expect(SUPPORTED_TOKENS.MIN).toEqual({
        symbol: 'MIN',
        policyId: '29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c6',
        assetName: '4d494e',
        minLiquidityThreshold: 100000
      });
    });
  });

  describe('getTokenConfig', () => {
    it('should return correct config for valid token symbols', () => {
      const indyConfig = getTokenConfig('INDY');
      expect(indyConfig).toEqual(SUPPORTED_TOKENS.INDY);

      const snekConfig = getTokenConfig('SNEK');
      expect(snekConfig).toEqual(SUPPORTED_TOKENS.SNEK);
    });

    it('should handle case insensitive symbols', () => {
      const indyConfig = getTokenConfig('indy');
      expect(indyConfig).toEqual(SUPPORTED_TOKENS.INDY);

      const snekConfig = getTokenConfig('snek');
      expect(snekConfig).toEqual(SUPPORTED_TOKENS.SNEK);

      const mixedConfig = getTokenConfig('InDy');
      expect(mixedConfig).toEqual(SUPPORTED_TOKENS.INDY);
    });

    it('should throw error for unsupported tokens', () => {
      expect(() => getTokenConfig('UNSUPPORTED')).toThrow('Unsupported token: UNSUPPORTED');
      expect(() => getTokenConfig('BTC')).toThrow('Unsupported token: BTC');
      expect(() => getTokenConfig('')).toThrow('Unsupported token: ');
    });
  });

  describe('isTokenSupported', () => {
    it('should return true for supported tokens', () => {
      expect(isTokenSupported('INDY')).toBe(true);
      expect(isTokenSupported('SNEK')).toBe(true);
      expect(isTokenSupported('NIGHT')).toBe(true);
      expect(isTokenSupported('MIN')).toBe(true);
    });

    it('should handle case insensitive symbols', () => {
      expect(isTokenSupported('indy')).toBe(true);
      expect(isTokenSupported('snek')).toBe(true);
      expect(isTokenSupported('InDy')).toBe(true);
      expect(isTokenSupported('SNEK')).toBe(true);
    });

    it('should return false for unsupported tokens', () => {
      expect(isTokenSupported('UNSUPPORTED')).toBe(false);
      expect(isTokenSupported('BTC')).toBe(false);
      expect(isTokenSupported('ETH')).toBe(false);
      expect(isTokenSupported('')).toBe(false);
    });
  });

  describe('getSupportedTokens', () => {
    it('should return all supported token symbols', () => {
      const supportedTokens = getSupportedTokens();
      expect(supportedTokens).toEqual(['INDY', 'SNEK', 'NIGHT', 'MIN']);
      expect(supportedTokens).toHaveLength(4);
    });

    it('should return a new array each time', () => {
      const tokens1 = getSupportedTokens();
      const tokens2 = getSupportedTokens();
      expect(tokens1).toEqual(tokens2);
      expect(tokens1).not.toBe(tokens2);
    });

    it('should contain only string values', () => {
      const supportedTokens = getSupportedTokens();
      supportedTokens.forEach(token => {
        expect(typeof token).toBe('string');
      });
    });
  });

  describe('integration', () => {
    it('should work together correctly', () => {
      const supportedTokens = getSupportedTokens();
      
      supportedTokens.forEach(symbol => {
        expect(isTokenSupported(symbol)).toBe(true);
        expect(() => getTokenConfig(symbol)).not.toThrow();
        
        const config = getTokenConfig(symbol);
        expect(config.symbol).toBe(symbol);
        expect(config.policyId).toBeTruthy();
        expect(config.assetName).toBeTruthy();
        expect(typeof config.minLiquidityThreshold).toBe('number');
      });
    });
  });
});