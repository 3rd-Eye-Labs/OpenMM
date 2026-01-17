/**
 * Kraken Utility Functions
 * Symbol conversion, error mapping, and validation utilities
 */
export class KrakenUtils {
  /**
   * Convert symbol from standard format to Kraken format
   * Standard: BTC/USD → Kraken: XXBTZUSD or XBTUSD
   * Standard: ETH/USD → Kraken: XETHZUSD
   */
  static toKrakenSymbol(symbol: string): string {
    const [base, quote] = symbol.split('/');

    const baseMap: Record<string, string> = {
      BTC: 'XBT',
      DOGE: 'XDG',
    };

    const mappedBase = baseMap[base] || base;

    if ((mappedBase === 'XBT' || base === 'ETH') && (quote === 'USD' || quote === 'EUR')) {
      return `X${mappedBase}Z${quote}`;
    }

    if (quote === 'USDC' || quote === 'USDT' || quote === 'DAI') {
      return `${mappedBase}${quote}`;
    }

    return `${mappedBase}${quote}`;
  }

  /**
   * Convert symbol from Kraken format to standard format
   * Kraken: XXBTZUSD → Standard: BTC/USD
   * Kraken: XETHZEUR → Standard: ETH/EUR
   */
  static fromKrakenSymbol(krakenSymbol: string): string {
    const symbolMap: Record<string, string> = {
      XXBTZUSD: 'BTC/USD',
      XETHZUSD: 'ETH/USD',
      XXBTZEUR: 'BTC/EUR',
      XETHZEUR: 'ETH/EUR',
      XBTUSD: 'BTC/USD',
      ETHUSD: 'ETH/USD',
      XBTEUR: 'BTC/EUR',
      ETHEUR: 'ETH/EUR',
    };

    if (symbolMap[krakenSymbol]) {
      return symbolMap[krakenSymbol];
    }

    const xzMatch = krakenSymbol.match(/^X([A-Z]{3})Z([A-Z]{3})$/);
    if (xzMatch) {
      const base = xzMatch[1] === 'XBT' ? 'BTC' : xzMatch[1];
      const quote = xzMatch[2];
      return `${base}/${quote}`;
    }

    const simpleMatch = krakenSymbol.match(/^([A-Z]{3,4})([A-Z]{3,4})$/);
    if (simpleMatch) {
      const base = simpleMatch[1] === 'XBT' ? 'BTC' : simpleMatch[1];
      const quote = simpleMatch[2];
      return `${base}/${quote}`;
    }

    return krakenSymbol;
  }

  /**
   * Map Kraken error codes to standardized error messages
   *
   * Kraken error format: { error: ["EAPI:Invalid key", "EGeneral:Invalid arguments"] }
   */
  static mapErrorMessage(krakenError: unknown): string {
    if (!krakenError) return 'Unknown error';

    if (Array.isArray(krakenError)) {
      return krakenError.join(', ');
    }

    const error = krakenError as Record<string, unknown>;
    const errorMessages = (error.error as string[]) || [];

    if (errorMessages.length === 0) {
      return typeof krakenError === 'string' ? krakenError : 'Unknown error';
    }

    const errorMap: Record<string, string> = {
      // API errors
      'EAPI:Invalid key': 'Invalid API key',
      'EAPI:Invalid signature': 'Invalid signature',
      'EAPI:Invalid nonce': 'Invalid or duplicate nonce',
      'EAPI:Invalid arguments': 'Invalid arguments provided',
      'EAPI:Feature disabled': 'Feature is disabled',

      // Permission errors
      'EGeneral:Permission denied': 'Permission denied for this operation',
      'EGeneral:Invalid arguments': 'Invalid arguments',

      // Order errors
      'EOrder:Invalid order': 'Invalid order',
      'EOrder:Unknown order': 'Order not found',
      'EOrder:Invalid price': 'Invalid price',
      'EOrder:Invalid volume': 'Invalid volume',
      'EOrder:Order minimum not met': 'Order minimum not met',
      'EOrder:Order limits exceeded': 'Order limits exceeded',
      'EOrder:Insufficient funds': 'Insufficient funds',
      'EOrder:Insufficient margin': 'Insufficient margin',
      'EOrder:Position limit exceeded': 'Position limit exceeded',
      'EOrder:Margin allowance exceeded': 'Margin allowance exceeded',

      // Trading errors
      'ETrade:Invalid pair': 'Invalid trading pair',
      'ETrade:Market closed': 'Market is closed',

      // Service errors
      'EService:Unavailable': 'Service temporarily unavailable',
      'EService:Busy': 'Service is busy, try again later',
      'EService:Market in cancel only mode': 'Market in cancel-only mode',
      'EService:Market in post only mode': 'Market in post-only mode',

      // Database errors
      'EDatabase:Internal error': 'Internal database error',
      'EDatabase:Unavailable': 'Database unavailable',

      // Network errors
      'ENetwork:Timeout': 'Network timeout',
      'ENetwork:Unavailable': 'Network unavailable',

      // General errors
      'EGeneral:Unknown method': 'Unknown method',
      'EGeneral:Invalid method': 'Invalid method',
      'EGeneral:Internal error': 'Internal error',
      'EGeneral:Rate limit': 'Rate limit exceeded',
    };

    const mappedErrors = errorMessages.map(errorMsg => {
      if (errorMap[errorMsg]) {
        return errorMap[errorMsg];
      }

      for (const [key, value] of Object.entries(errorMap)) {
        if (errorMsg.includes(key.split(':')[0])) {
          return value;
        }
      }

      return errorMsg;
    });

    return `Kraken Error: ${mappedErrors.join(', ')}`;
  }

  /**
   * Parse timestamp from Kraken response
   * Kraken uses seconds (as number) for timestamps
   */
  static parseTimestamp(timestamp: string | number): number {
    const ts = typeof timestamp === 'string' ? parseFloat(timestamp) : timestamp;

    if (ts < 10000000000) {
      return Math.floor(ts * 1000);
    }

    return Math.floor(ts);
  }

  /**
   * Validate Kraken order response
   */
  static isValidOrderResponse(response: unknown): boolean {
    const order = response as Record<string, unknown>;
    return (
      order &&
      typeof order.txid === 'string' &&
      typeof order.status === 'string' &&
      order.descr !== undefined
    );
  }

  /**
   * Convert order side from Kraken format
   * Kraken: buy/sell → Standard: buy/sell
   */
  static fromKrakenOrderSide(side: string): 'buy' | 'sell' {
    return side.toLowerCase() as 'buy' | 'sell';
  }

  /**
   * Convert order type from Kraken format
   * Kraken: limit/market → Standard: limit/market
   */
  static fromKrakenOrderType(type: string): 'limit' | 'market' {
    return type.toLowerCase() as 'limit' | 'market';
  }

  /**
   * Map Kraken order status to standard format
   */
  static mapOrderStatus(
    status: string
  ): 'open' | 'filled' | 'cancelled' | 'rejected' | 'partially_filled' {
    const statusMap: Record<
      string,
      'open' | 'filled' | 'cancelled' | 'rejected' | 'partially_filled'
    > = {
      pending: 'open',
      new: 'open',
      open: 'open',
      closed: 'filled',
      canceled: 'cancelled',
      expired: 'cancelled',
      'partially-filled': 'partially_filled',
    };

    return statusMap[status.toLowerCase()] || 'rejected';
  }
}
