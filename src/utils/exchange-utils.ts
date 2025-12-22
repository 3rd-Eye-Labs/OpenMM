import { OrderType, OrderSide } from '../types';
import { MexcOrderParams } from '../types';
import { toExchangeFormat } from './symbol-utils';

/**
 * Shared utility functions for exchange operations
 *
 * This module provides common functionality that can be used across different exchange connectors
 * to avoid code duplication and maintain consistency.
 */
export class ExchangeUtils {
  /**
   * Validate common order parameters
   *
   * @param symbol - Trading pair symbol
   * @param type - Order type
   * @param side - Order side
   * @param amount - Order amount
   * @param price - Optional price for limit orders
   * @throws Error if parameters are invalid
   */
  private static validateOrderParams(
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price?: number
  ): void {
    if (!symbol || !type || !side || !amount) {
      throw new Error(
        'Missing required order parameters: symbol, type, side, and amount are required'
      );
    }

    if (amount <= 0) {
      throw new Error('Order amount must be greater than 0');
    }

    if (type === 'limit') {
      if (!price || price <= 0) {
        throw new Error('Price is required and must be greater than 0 for limit orders');
      }
    }
  }

  /**
   * Create standardized order parameters for exchange APIs
   *
   * @param symbol - Trading pair symbol (e.g., 'SNEK/USDT')
   * @param type - Order type ('market' or 'limit')
   * @param side - Order side ('buy' or 'sell')
   * @param amount - Order quantity/amount
   * @param price - Optional. Price for limit orders (required for limit orders)
   * @param exchangeFormat - Exchange-specific parameter formatting function
   * @returns Record with order parameters formatted for the exchange
   * @throws Error if required parameters are missing or invalid
   */
  static createOrderParams<T = Record<string, string | number>>(
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price?: number,
    exchangeFormat?: (params: {
      symbol: string;
      type: OrderType;
      side: OrderSide;
      amount: number;
      price?: number;
    }) => T
  ): T {
    this.validateOrderParams(symbol, type, side, amount, price);

    try {
      const exchangeSymbol = toExchangeFormat(symbol);

      const baseParams = {
        symbol: exchangeSymbol,
        type,
        side,
        amount,
        price,
      };

      if (exchangeFormat) {
        return exchangeFormat(baseParams);
      }

      const params: Record<string, string | number> = {
        symbol: exchangeSymbol,
        side: side.toLowerCase(),
        type: type.toLowerCase(),
        amount: amount,
      };

      if (type === 'limit' && price !== undefined) {
        params.price = price;
      }

      return params as T;
    } catch (error) {
      throw new Error(`Failed to create order parameters: ${error}`);
    }
  }

  /**
   * Create Bitget-specific order parameters
   *
   * @param symbol - Trading pair symbol (e.g., 'SNEK/USDT')
   * @param type - Order type ('market' or 'limit')
   * @param side - Order side ('buy' or 'sell')
   * @param amount - Order quantity/amount
   * @param price - Optional. Price for limit orders
   * @returns Bitget-formatted order parameters
   */
  static createBitgetOrderParams(
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price?: number
  ): Record<string, string> {
    return this.createOrderParams(symbol, type, side, amount, price, params => {
      this.validateBitgetMinimumOrder(params.amount, params.price, params.symbol);

      const bitgetParams: Record<string, string> = {
        symbol: params.symbol,
        side: params.side.toLowerCase(),
        orderType: params.type.toLowerCase(),
        force: 'gtc',
        size: this.formatBitgetQuantity(params.amount, params.symbol),
      };

      if (params.type === 'limit' && params.price !== undefined) {
        bitgetParams.price = this.formatBitgetPrice(params.price, params.symbol);
      }

      return bitgetParams;
    });
  }

  /**
   * Format quantity for Bitget with appropriate precision
   *
   * @param quantity - The quantity to format
   * @param symbol - Trading pair symbol for precision rules
   * @returns Formatted quantity string with correct decimal places
   */
  private static formatBitgetQuantity(quantity: number, symbol: string): string {
    const precision = this.getBitgetQuantityPrecision(symbol);
    return quantity.toFixed(precision);
  }

  /**
   * Format price for Bitget with appropriate precision
   *
   * @param price - The price to format
   * @param symbol - Trading pair symbol for precision rules
   * @returns Formatted price string with correct decimal places
   */
  private static formatBitgetPrice(price: number, symbol: string): string {
    const precision = this.getBitgetPricePrecision(symbol);
    return price.toFixed(precision);
  }

  /**
   * Get quantity precision for Bitget symbol
   * Based on common Bitget precision rules
   *
   * @param symbol - Trading pair symbol
   * @returns Number of decimal places for quantity
   */
  private static getBitgetQuantityPrecision(symbol: string): number {
    if (symbol.includes('USDT') || symbol.includes('USDC')) {
      if (symbol.includes('SNEK') || symbol.includes('INDY') || symbol.includes('NIGHT')) {
        return 2;
      }
      if (symbol.includes('BTC') || symbol.includes('ETH')) {
        return 6;
      }
    }
    return 4;
  }

  /**
   * Get price precision for Bitget symbol
   * Based on common Bitget precision rules
   *
   * @param symbol - Trading pair symbol
   * @returns Number of decimal places for price
   */
  private static getBitgetPricePrecision(symbol: string): number {
    if (symbol.includes('USDT') || symbol.includes('USDC')) {
      if (symbol.includes('SNEK') || symbol.includes('NIGHT')) {
        return 6;
      }
      if (symbol.includes('INDY')) {
        return 6;
      }
      if (symbol.includes('BTC')) {
        return 2;
      }
      if (symbol.includes('ETH')) {
        return 3;
      }
    }
    return 6;
  }

  /**
   * Validate minimum order value for Bitget
   * Bitget requires minimum order value of 1 USDT
   *
   * @param amount - Order quantity
   * @param price - Order price
   * @param symbol - Trading pair symbol
   * @throws Error if order value is below minimum
   */
  private static validateBitgetMinimumOrder(amount: number, price?: number, symbol?: string): void {
    if (price && symbol && (symbol.includes('USDT') || symbol.includes('USDC'))) {
      const orderValue = amount * price;
      const minimumValue = 1.0;

      if (orderValue < minimumValue) {
        throw new Error(
          `Bitget order value ${orderValue.toFixed(6)} USDT is below minimum ${minimumValue} USDT. Increase order size or price.`
        );
      }
    }
  }

  /**
   * Create MEXC-specific order parameters
   *
   * @param symbol - Trading pair symbol (e.g., 'SNEK/USDT')
   * @param type - Order type ('market' or 'limit')
   * @param side - Order side ('buy' or 'sell')
   * @param amount - Order quantity/amount
   * @param price - Optional. Price for limit orders
   * @returns MEXC-formatted order parameters
   */
  static createMexcOrderParams(
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price?: number
  ): MexcOrderParams {
    return this.createOrderParams(symbol, type, side, amount, price, params => {
      const mexcParams: MexcOrderParams = {
        symbol: params.symbol,
        side: params.side.toUpperCase(),
        type: params.type.toUpperCase(),
        quantity: params.amount.toString(),
      };

      if (params.type === 'limit' && params.price !== undefined) {
        mexcParams.price = params.price.toString();
        mexcParams.timeInForce = 'GTC';
      }

      return mexcParams;
    });
  }

  /**
   * Create Gate.io-specific order parameters
   *
   * @param symbol - Trading pair symbol (e.g., 'SNEK/USDT')
   * @param type - Order type ('market' or 'limit')
   * @param side - Order side ('buy' or 'sell')
   * @param amount - Order quantity/amount
   * @param price - Optional. Price for limit orders
   * @returns Gate.io-formatted order parameters
   */
  static createGateioOrderParams(
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price?: number
  ): Record<string, string> {
    this.validateOrderParams(symbol, type, side, amount, price);

    // Validate minimum order value for Gate.io
    this.validateGateioMinimumOrder(amount, price, symbol);

    const gateioSymbol = symbol.replace('/', '_').toUpperCase();

    const gateioParams: Record<string, string> = {
      currency_pair: gateioSymbol,
      side: side.toLowerCase(),
      type: type.toLowerCase(),
      account: 'spot',
      amount: amount.toString(),
    };

    if (type === 'limit' && price !== undefined) {
      gateioParams.price = price.toString();
    }

    return gateioParams;
  }

  /**
   * Validate minimum order value for Gate.io
   * Gate.io requires minimum order value of 3 USDT
   *
   * @param amount - Order quantity
   * @param price - Order price
   * @param symbol - Trading pair symbol
   * @throws Error if order value is below minimum
   */
  private static validateGateioMinimumOrder(amount: number, price?: number, symbol?: string): void {
    if (price && symbol && (symbol.includes('USDT') || symbol.includes('USDC'))) {
      const orderValue = amount * price;
      const minimumValue = 3.0;

      if (orderValue < minimumValue) {
        throw new Error(
          `Gate.io order value ${orderValue.toFixed(6)} USDT is below minimum ${minimumValue} USDT. Increase order size or price.`
        );
      }
    }
  }

  /**
   * Get minimum order value for exchange
   *
   * @param exchange - Exchange name ('bitget', 'mexc', 'gateio', etc.)
   * @param symbol - Trading pair symbol
   * @returns Minimum order value in quote currency
   */
  static getMinimumOrderValue(exchange: string, symbol: string): number {
    switch (exchange.toLowerCase()) {
      case 'bitget':
        if (symbol.includes('USDT') || symbol.includes('USDC')) {
          return 1.0;
        }
        return 0;
      case 'mexc':
        if (symbol.includes('USDT') || symbol.includes('USDC')) {
          return 1.0;
        }
        return 0;
      case 'gateio':
        if (symbol.includes('USDT') || symbol.includes('USDC')) {
          return 3.0;
        }
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Validate symbol format for exchange compatibility
   *
   * @param symbol - Symbol to validate
   * @returns True if symbol is valid, false otherwise
   */
  static isValidSymbol(symbol: string): boolean {
    if (!symbol) {
      return false;
    }

    try {
      const exchangeFormat = toExchangeFormat(symbol);
      return exchangeFormat.length > 0 && /^[A-Z0-9]+$/.test(exchangeFormat);
    } catch {
      return false;
    }
  }
}
