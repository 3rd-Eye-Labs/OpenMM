import chalk from 'chalk';

/**
 * Handle CLI errors with consistent formatting
 * @param error Error object or message
 * @param context Context where the error occurred
 */
export function handleError(error: Error | string, context?: string): void {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const contextStr = context ? ` [${context}]` : '';

  console.error(chalk.red(`❌ Error${contextStr}: ${errorMessage}`));

  if (process.env.NODE_ENV === 'development' && typeof error === 'object' && error.stack) {
    console.error(chalk.gray(error.stack));
  }

  process.exit(1);
}

/**
 * Handle async command execution with error handling
 * @param fn Async function to execute
 * @param context Context for error handling
 */
export async function executeCommand(fn: () => Promise<void>, context: string): Promise<void> {
  try {
    await fn();
  } catch (error) {
    handleError(error as Error, context);
  }
}

/**
 * Display success message
 * @param message Success message to display
 */
export function showSuccess(message: string): void {
  console.log(chalk.green(`✅ ${message}`));
}

/**
 * Display warning message
 * @param message Warning message to display
 */
export function showWarning(message: string): void {
  console.log(chalk.yellow(`⚠️  ${message}`));
}

/**
 * Display info message
 * @param message Info message to display
 */
export function showInfo(message: string): void {
  console.log(chalk.blue(`ℹ️  ${message}`));
}

/**
 * Display data in a formatted table
 * @param data Array of objects to display
 * @param headers Optional custom headers
 */
export function displayTable(data: Record<string, any>[], headers?: string[]): void {
  if (data.length === 0) {
    showInfo('No data to display');
    return;
  }

  const keys = headers || Object.keys(data[0]);
  const columnWidths = keys.map(key => {
    const maxWidth = Math.max(key.length, ...data.map(row => String(row[key] || '').length));
    return Math.min(maxWidth, 20);
  });

  const headerRow = keys.map((key, i) => chalk.bold(key.padEnd(columnWidths[i]))).join(' │ ');
  console.log(headerRow);

  const separator = columnWidths.map(width => '─'.repeat(width)).join('─┼─');
  console.log(separator);

  data.forEach(row => {
    const dataRow = keys
      .map((key, i) => {
        let value = String(row[key] || '');
        if (value.length > columnWidths[i]) {
          value = value.substring(0, columnWidths[i] - 3) + '...';
        }
        return value.padEnd(columnWidths[i]);
      })
      .join(' │ ');
    console.log(dataRow);
  });
}

/**
 * Format balance display
 * @param balance Balance object
 * @param asset Asset name
 */
export function displayBalance(balance: any, asset?: string): void {
  if (asset) {
    console.log(`\n${chalk.bold.cyan(asset)} Balance:`);
    console.log(`  Free:      ${chalk.green(balance.free.toFixed(8))}`);
    console.log(`  Used:      ${chalk.yellow(balance.used.toFixed(8))}`);
    console.log(`  Total:     ${chalk.blue(balance.total.toFixed(8))}`);
    console.log(`  Available: ${chalk.green(balance.available.toFixed(8))}`);
  } else {
    const balances = Object.entries(balance as Record<string, any>).map(
      ([asset, bal]: [string, any]) => ({
        Asset: asset,
        Free: bal.free.toFixed(8),
        Used: bal.used.toFixed(8),
        Total: bal.total.toFixed(8),
      })
    );

    console.log(`\n${chalk.bold.cyan('Account Balances')}:`);
    displayTable(balances);
  }
}
