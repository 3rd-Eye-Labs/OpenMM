import { toStandardFormat, toExchangeFormat } from '../../utils/symbol-utils';

/**
 * Bitget Utility Functions
 *
 * Handles data transformation between Bitget API responses and OpenMM standard formats.
 * Focuses on core transformations needed for market data and trading operations.
 */
export class BitgetUtils {
  /**
   * Map Bitget error codes to standardized error messages
   */
  static mapErrorMessage(bitgetError: any): string {
    if (!bitgetError) return 'Unknown error';

    const errorCode = bitgetError.code || bitgetError.errorCode;
    const errorMsg = bitgetError.msg || bitgetError.message || 'Unknown error';

    const errorMap: Record<string, string> = {
      '40001': 'Invalid API key',
      '40002': 'Invalid signature',
      '40003': 'Invalid timestamp',
      '40004': 'Invalid passphrase',
      '40005': 'Request timeout',
      '40006': 'Invalid symbol',
      '40007': 'Invalid order type',
      '40008': 'Invalid order side',
      '40009': 'Invalid order size',
      '40010': 'Invalid order price',
      '43025': 'Insufficient balance',
      '43026': 'Order amount too small',
      '43027': 'Order amount too large',
      '43028': 'Order not found',
      '50001': 'Internal server error',
      '50002': 'Service unavailable',
      '50003': 'Rate limit exceeded',
    };

    const mappedMessage = errorMap[errorCode];
    if (mappedMessage) {
      return `${mappedMessage} (Code: ${errorCode})`;
    }

    return `Bitget Error: ${errorMsg} (Code: ${errorCode || 'Unknown'})`;
  }

  /**
   * Validate if symbol is supported format for Bitget
   */
  static isValidSymbol(symbol: string): boolean {
    try {
      const standardFormat = toStandardFormat(symbol);
      const bitgetFormat = toExchangeFormat(standardFormat);
      return bitgetFormat.length > 0 && /^[A-Z0-9]+$/.test(bitgetFormat);
    } catch {
      return false;
    }
  }
}
