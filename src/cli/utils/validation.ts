import chalk from 'chalk';
import { ExchangeFactory, SupportedExchange } from '../exchange-factory';

/**
 * Validate exchange parameter
 * @param exchange Exchange name to validate
 * @returns Valid exchange name
 */
export function validateExchange(exchange: string): SupportedExchange {
  if (!ExchangeFactory.isSupported(exchange)) {
    const supportedExchanges = ExchangeFactory.getSupportedExchanges().join(', ');
    console.error(chalk.red(`❌ Unsupported exchange: ${exchange}`));
    console.log(chalk.yellow(`Supported exchanges: ${supportedExchanges}`));
    process.exit(1);
  }
  return exchange as SupportedExchange;
}

/**
 * Validate symbol format
 * @param symbol Trading pair symbol to validate (e.g., BTC/USDT)
 * @returns Valid symbol
 */
export function validateSymbol(symbol: string): string {
  if (!symbol) {
    console.error(chalk.red('❌ Symbol is required'));
    process.exit(1);
  }

  if (!/^[A-Za-z]+\/[A-Za-z]+$/.test(symbol) && !/^[A-Za-z]+[A-Za-z]+$/.test(symbol)) {
    console.error(chalk.red(`❌ Invalid symbol format: ${symbol}`));
    console.log(chalk.yellow('Expected format: BTC/USDT or BTCUSDT'));
    process.exit(1);
  }

  return symbol.toUpperCase();
}

/**
 * Validate order ID
 * @param orderId Order ID to validate
 * @returns Valid order ID
 */
export function validateOrderId(orderId: string): string {
  if (!orderId || orderId.trim().length === 0) {
    console.error(chalk.red('❌ Order ID is required'));
    process.exit(1);
  }
  return orderId.trim();
}

/**
 * Validate positive number
 * @param value Value to validate
 * @param fieldName Name of the field for error messages
 * @returns Valid positive number
 */
export function validatePositiveNumber(value: string, fieldName: string): number {
  const num = parseFloat(value);

  if (isNaN(num)) {
    console.error(chalk.red(`❌ ${fieldName} must be a valid number`));
    process.exit(1);
  }

  if (num <= 0) {
    console.error(chalk.red(`❌ ${fieldName} must be a positive number`));
    process.exit(1);
  }

  return num;
}

/**
 * Validate order type
 * @param type Order type to validate
 * @returns Valid order type
 */
export function validateOrderType(type: string): 'market' | 'limit' {
  const validTypes = ['market', 'limit'];
  const lowerType = type.toLowerCase();

  if (!validTypes.includes(lowerType)) {
    console.error(chalk.red(`❌ Invalid order type: ${type}`));
    console.log(chalk.yellow(`Valid types: ${validTypes.join(', ')}`));
    process.exit(1);
  }

  return lowerType as 'market' | 'limit';
}

/**
 * Validate order side
 * @param side Order side to validate
 * @returns Valid order side
 */
export function validateOrderSide(side: string): 'buy' | 'sell' {
  const validSides = ['buy', 'sell'];
  const lowerSide = side.toLowerCase();

  if (!validSides.includes(lowerSide)) {
    console.error(chalk.red(`❌ Invalid order side: ${side}`));
    console.log(chalk.yellow(`Valid sides: ${validSides.join(', ')}`));
    process.exit(1);
  }

  return lowerSide as 'buy' | 'sell';
}

/**
 * Check if required options are provided
 * @param options Object containing options to check
 * @param required Array of required option names
 */
export function requireOptions(options: Record<string, any>, required: string[]): void {
  const missing = required.filter(key => !options[key]);

  if (missing.length > 0) {
    console.error(chalk.red(`❌ Missing required options: ${missing.join(', ')}`));
    process.exit(1);
  }
}
