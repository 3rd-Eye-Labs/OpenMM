import { parseSymbol, toStandardFormat, toExchangeFormat } from '../../../utils/symbol-utils';

describe('Symbol Utils', () => {
  describe('parseSymbol', () => {
    it('should parse symbols with slash separator', () => {
      const result = parseSymbol('BTC/USDT');
      expect(result).toEqual({ base: 'BTC', quote: 'USDT' });
    });

    it('should parse symbols with slash separator and extra whitespace', () => {
      const result = parseSymbol('  ETH / USDC  ');
      expect(result).toEqual({ base: 'ETH', quote: 'USDC' });
    });

    it('should handle lowercase symbols with slash', () => {
      const result = parseSymbol('btc/usdt');
      expect(result).toEqual({ base: 'BTC', quote: 'USDT' });
    });
    it('should parse symbols ending with USDT', () => {
      const result = parseSymbol('BTCUSDT');
      expect(result).toEqual({ base: 'BTC', quote: 'USDT' });
    });
    it('should parse symbols ending with USDC', () => {
      const result = parseSymbol('ETHUSDC');
      expect(result).toEqual({ base: 'ETH', quote: 'USDC' });
    });
    it('should parse symbols ending with BUSD', () => {
      const result = parseSymbol('ADABUSD');
      expect(result).toEqual({ base: 'ADA', quote: 'BUSD' });
    });
    it('should parse symbols ending with USD', () => {
      const result = parseSymbol('BTCUSD');
      expect(result).toEqual({ base: 'BTC', quote: 'USD' });
    });
    it('should parse symbols ending with BTC', () => {
      const result = parseSymbol('ETHBTC');
      expect(result).toEqual({ base: 'ETH', quote: 'BTC' });
    });
    it('should parse symbols ending with ETH', () => {
      const result = parseSymbol('LINKETH');
      expect(result).toEqual({ base: 'LINK', quote: 'ETH' });
    });
    it('should parse symbols ending with BNB', () => {
      const result = parseSymbol('ADABNB');
      expect(result).toEqual({ base: 'ADA', quote: 'BNB' });
    });
    it('should handle lowercase symbols without slash', () => {
      const result = parseSymbol('btcusdt');
      expect(result).toEqual({ base: 'BTC', quote: 'USDT' });
    });
    it('should handle symbols with extra whitespace', () => {
      const result = parseSymbol('  BTCUSDT  ');
      expect(result).toEqual({ base: 'BTC', quote: 'USDT' });
    });
    it('should prefer longer quote currencies first', () => {
      const result = parseSymbol('USDTETH');
      expect(result).toEqual({ base: 'USDT', quote: 'ETH' });
    });
    it('should handle complex base symbols', () => {
      const result = parseSymbol('SHIBAINU/USDT');
      expect(result).toEqual({ base: 'SHIBAINU', quote: 'USDT' });
    });
    it('should handle complex base symbols without slash', () => {
      const result = parseSymbol('SHIBAINUUSDT');
      expect(result).toEqual({ base: 'SHIBAINU', quote: 'USDT' });
    });
    it('should throw error for unparseable symbols', () => {
      expect(() => parseSymbol('INVALIDFORMAT')).toThrow('Unable to parse symbol: INVALIDFORMAT');
    });
    it('should throw error for empty symbols', () => {
      expect(() => parseSymbol('')).toThrow('Unable to parse symbol: ');
    });
    it('should throw error for symbols with only quote currency', () => {
      expect(() => parseSymbol('USDT')).toThrow('Unable to parse symbol: USDT');
    });
    it('should handle symbols with slash but empty parts', () => {
      expect(parseSymbol('/')).toEqual({ base: '', quote: '' });
      expect(parseSymbol('BTC/')).toEqual({ base: 'BTC', quote: '' });
      expect(parseSymbol('/USDT')).toEqual({ base: '', quote: 'USDT' });
    });
    it('should handle symbols with multiple potential quote currencies', () => {
      const result = parseSymbol('USDCUSDT');
      expect(result).toEqual({ base: 'USDC', quote: 'USDT' });
    });
  });
  describe('toStandardFormat', () => {
    it('should convert exchange format to standard format', () => {
      const result = toStandardFormat('BTCUSDT');
      expect(result).toBe('BTC/USDT');
    });
    it('should keep standard format unchanged', () => {
      const result = toStandardFormat('BTC/USDT');
      expect(result).toBe('BTC/USDT');
    });
    it('should handle lowercase symbols', () => {
      const result = toStandardFormat('btcusdt');
      expect(result).toBe('BTC/USDT');
    });
    it('should handle symbols with whitespace', () => {
      const result = toStandardFormat('  ETHUSDC  ');
      expect(result).toBe('ETH/USDC');
    });
    it('should handle different quote currencies', () => {
      expect(toStandardFormat('BTCUSD')).toBe('BTC/USD');
      expect(toStandardFormat('ETHBTC')).toBe('ETH/BTC');
      expect(toStandardFormat('ADABNB')).toBe('ADA/BNB');
    });
    it('should throw error for invalid symbols', () => {
      expect(() => toStandardFormat('INVALID')).toThrow('Unable to parse symbol: INVALID');
    });
  });
  describe('toExchangeFormat', () => {
    it('should convert standard format to exchange format', () => {
      const result = toExchangeFormat('BTC/USDT');
      expect(result).toBe('BTCUSDT');
    });
    it('should keep exchange format unchanged', () => {
      const result = toExchangeFormat('BTCUSDT');
      expect(result).toBe('BTCUSDT');
    });
    it('should handle lowercase symbols', () => {
      const result = toExchangeFormat('btc/usdt');
      expect(result).toBe('BTCUSDT');
    });
    it('should handle symbols with whitespace', () => {
      const result = toExchangeFormat('  ETH / USDC  ');
      expect(result).toBe('ETHUSDC');
    });
    it('should handle different quote currencies', () => {
      expect(toExchangeFormat('BTC/USD')).toBe('BTCUSD');
      expect(toExchangeFormat('ETH/BTC')).toBe('ETHBTC');
      expect(toExchangeFormat('ADA/BNB')).toBe('ADABNB');
    });
    it('should throw error for invalid symbols', () => {
      expect(() => toExchangeFormat('INVALID')).toThrow('Unable to parse symbol: INVALID');
    });
  });
  describe('round-trip conversions', () => {
    it('should maintain consistency through round-trip conversions', () => {
      const testCases = ['BTCUSDT', 'BTC/USDT', 'ETHUSDC', 'ETH/USDC', 'LINKBTC', 'LINK/BTC'];
      testCases.forEach(symbol => {
        const standard = toStandardFormat(symbol);
        const exchange = toExchangeFormat(standard);
        const backToStandard = toStandardFormat(exchange);
        expect(backToStandard).toBe(standard);
      });
    });
    it('should normalize different input formats to same output', () => {
      const inputs = ['BTCUSDT', 'BTC/USDT', 'btc/usdt', '  BTC / USDT  '];
      inputs.forEach(input => {
        expect(toStandardFormat(input)).toBe('BTC/USDT');
        expect(toExchangeFormat(input)).toBe('BTCUSDT');
      });
    });
  });
  describe('edge cases', () => {
    it('should handle symbols with numbers', () => {
      expect(parseSymbol('1INCHUSDT')).toEqual({ base: '1INCH', quote: 'USDT' });
      expect(toStandardFormat('1INCHUSDT')).toBe('1INCH/USDT');
      expect(toExchangeFormat('1INCH/USDT')).toBe('1INCHUSDT');
    });
    it('should handle very long base symbols', () => {
      const longSymbol = 'VERYLONGCOINNAMEUSDT';
      expect(parseSymbol(longSymbol)).toEqual({ base: 'VERYLONGCOINNAME', quote: 'USDT' });
    });
    it('should maintain case consistency', () => {
      const result = parseSymbol('mytoken/USDT');
      expect(result).toEqual({ base: 'MYTOKEN', quote: 'USDT' });
    });
  });
});
