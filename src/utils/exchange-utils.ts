import { OrderType, OrderSide } from '../types';
import { toExchangeFormat } from './symbol-utils';

/**
 * Shared utility functions for exchange operations
 * 
 * This module provides common functionality that can be used across different exchange connectors
 * to avoid code duplication and maintain consistency.
 */
export class ExchangeUtils {

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
    if (!symbol || !type || !side || !amount) {
      throw new Error('Missing required order parameters: symbol, type, side, and amount are required');
    }

    if (amount <= 0) {
      throw new Error('Order amount must be greater than 0');
    }

    if (type === 'limit') {
      if (!price || price <= 0) {
        throw new Error('Price is required and must be greater than 0 for limit orders');
      }
    }

    try {
      const exchangeSymbol = toExchangeFormat(symbol);
      
      const baseParams = {
        symbol: exchangeSymbol,
        type,
        side,
        amount,
        price
      };

      if (exchangeFormat) {
        return exchangeFormat(baseParams);
      }

      const params: Record<string, string | number> = {
        symbol: exchangeSymbol,
        side: side.toLowerCase(),
        type: type.toLowerCase(),
        amount: amount
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
    return this.createOrderParams(
      symbol,
      type,
      side,
      amount,
      price,
      (params) => {
        const bitgetParams: Record<string, string> = {
          symbol: params.symbol,
          side: params.side.toLowerCase(),
          orderType: params.type.toLowerCase(),
          force: 'gtc',
          size: params.amount.toString()
        };

        if (params.type === 'limit' && params.price !== undefined) {
          bitgetParams.price = params.price.toString();
        }

        return bitgetParams;
      }
    );
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
  ): Record<string, any> {
    return this.createOrderParams(
      symbol,
      type,
      side,
      amount,
      price,
      (params) => {
        const mexcParams: Record<string, any> = {
          symbol: params.symbol,
          side: params.side.toUpperCase(),
          type: params.type.toUpperCase(),
          quantity: params.amount.toString()
        };

        if (params.type === 'limit' && params.price !== undefined) {
          mexcParams.price = params.price.toString();
          mexcParams.timeInForce = 'GTC';
        }

        return mexcParams;
      }
    );
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