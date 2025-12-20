/**
 * Gate.io Utility Functions
 * Symbol conversion and error mapping
 */
export class GateioUtils {
  /**
   * Convert symbol from standard format to Gate.io format
   * Standard: SNEK/USDT → Gate.io: SNEK_USDT
   */
  static toGateioSymbol(symbol: string): string {
    return symbol.replace('/', '_').toUpperCase();
  }

  /**
   * Convert symbol from Gate.io format to standard format
   * Gate.io: SNEK_USDT → Standard: SNEK/USDT
   */
  static fromGateioSymbol(gateioSymbol: string): string {
    return gateioSymbol.replace('_', '/').toUpperCase();
  }

  /**
   * Map Gate.io error responses to standardized error messages
   *
   * Gate.io error format: { label: "ERROR_LABEL", message: "description" }
   */
  static mapErrorMessage(gateioError: unknown): string {
    if (!gateioError) return 'Unknown error';

    const error = gateioError as Record<string, unknown>;
    const errorLabel = error.label || '';
    const errorMsg = error.message || 'Unknown error';

    const errorMap: Record<string, string> = {
      INVALID_PARAM_VALUE: 'Invalid parameter value',
      INVALID_PROTOCOL: 'Invalid protocol',
      INVALID_ARGUMENT: 'Invalid argument',
      INVALID_REQUEST_BODY: 'Invalid request body',
      INVALID_CURRENCY: 'Invalid currency',
      INVALID_CURRENCY_PAIR: 'Invalid trading pair',
      INVALID_PRECISION: 'Invalid precision',

      // Order errors
      INVALID_ORDER_ID: 'Invalid order ID',
      ORDER_NOT_FOUND: 'Order not found',
      ORDER_CLOSED: 'Order already closed',
      ORDER_CANCELLED: 'Order already cancelled',

      // Balance errors
      INSUFFICIENT_BALANCE: 'Insufficient balance',
      BALANCE_NOT_ENOUGH: 'Balance not enough',

      // Trading errors
      AMOUNT_TOO_SMALL: 'Order amount too small',
      AMOUNT_TOO_LARGE: 'Order amount too large',
      PRICE_TOO_HIGH: 'Price too high',
      PRICE_TOO_LOW: 'Price too low',
      INVALID_PRICE: 'Invalid price',

      // Authentication errors
      INVALID_KEY: 'Invalid API key',
      INVALID_SIGNATURE: 'Invalid signature',
      SIGNATURE_NOT_MATCH: 'Signature does not match',
      IP_FORBIDDEN: 'IP not whitelisted',
      PERMISSION_DENIED: 'Permission denied',
      KEY_EXPIRED: 'API key expired',

      // Rate limiting
      TOO_MANY_REQUESTS: 'Rate limit exceeded',
      REQUEST_TOO_FAST: 'Requests too frequent',

      // Market errors
      MARKET_CLOSED: 'Market is closed',
      MARKET_NOT_FOUND: 'Market not found',
      PAIR_NOT_FOUND: 'Trading pair not found',

      // System errors
      SYSTEM_ERROR: 'System error',
      SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
    };

    const mappedMessage = errorMap[errorLabel as string];
    if (mappedMessage) {
      return `${mappedMessage} (${errorLabel})`;
    }

    return `Gate.io Error: ${errorMsg} (${errorLabel || 'Unknown'})`;
  }

  /**
   * Validate if symbol is in supported format for Gate.io
   */
  static isValidSymbol(symbol: string): boolean {
    try {
      const gateioFormat = this.toGateioSymbol(symbol);

      return /^[A-Z0-9]+_[A-Z0-9]+$/.test(gateioFormat);
    } catch {
      return false;
    }
  }

  /**
   * Parse timestamp from Gate.io response
   * Gate.io can use seconds (as string) or milliseconds
   */
  static parseTimestamp(timestamp: string | number): number {
    const ts = typeof timestamp === 'string' ? parseFloat(timestamp) : timestamp;

    if (ts < 10000000000) {
      return ts * 1000;
    }

    return ts;
  }

  /**
   * Validate Gate.io order response
   */
  static isValidOrderResponse(response: unknown): boolean {
    const order = response as Record<string, unknown>;
    return (
      order &&
      typeof order.id === 'string' &&
      typeof order.currency_pair === 'string' &&
      typeof order.status === 'string'
    );
  }

  /**
   * Extract currency pair list from open orders response
   * Gate.io returns: [{ currency_pair, total, orders: [...] }]
   */
  static extractOrdersFromOpenOrdersResponse(response: unknown[]): unknown[] {
    const allOrders: unknown[] = [];

    if (!Array.isArray(response)) {
      return allOrders;
    }

    response.forEach(group => {
      const groupData = group as Record<string, unknown>;
      if (groupData.orders && Array.isArray(groupData.orders)) {
        allOrders.push(...groupData.orders);
      }
    });

    return allOrders;
  }

  /**
   * Normalize symbol format (uppercase)
   */
  static normalizeSymbol(symbol: string): string {
    return symbol.toUpperCase();
  }
}
