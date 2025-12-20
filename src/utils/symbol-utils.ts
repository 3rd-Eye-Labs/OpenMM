/**
 * Symbol Utility Functions
 * Centralizes symbol format conversion logic used across exchanges and strategies
 */

export function parseSymbol(symbol: string): { base: string; quote: string } {
  const symbolUpper = symbol.toUpperCase().trim();

  if (symbolUpper.includes('/')) {
    const [base, quote] = symbolUpper.split('/');
    return { base: base.trim(), quote: quote.trim() };
  }

  const quoteCurrencies = ['USDT', 'USDC', 'BUSD', 'USD', 'BTC', 'ETH', 'BNB'];

  for (const quote of quoteCurrencies) {
    if (symbolUpper.endsWith(quote)) {
      const base = symbolUpper.slice(0, -quote.length);
      if (base.length > 0) {
        return { base, quote };
      }
    }
  }

  throw new Error(`Unable to parse symbol: ${symbol}`);
}

/**
 * Convert symbol to standard format (INDY/USDT)
 */
export function toStandardFormat(symbol: string): string {
  const { base, quote } = parseSymbol(symbol);
  return `${base}/${quote}`;
}

/**
 * Convert symbol to exchange format (INDYUSDT)
 */
export function toExchangeFormat(symbol: string): string {
  const { base, quote } = parseSymbol(symbol);
  return `${base}${quote}`;
}
