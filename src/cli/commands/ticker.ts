import { Command } from 'commander';
import chalk from 'chalk';
import { ExchangeFactory } from '../exchange-factory';
import { validateExchange, validateSymbol } from '../utils/validation';
import { executeCommand, handleError } from '../utils/error-handler';

export const tickerCommand = new Command('ticker')
  .description('Get ticker data for a trading pair')
  .requiredOption('-e, --exchange <exchange>', 'Exchange to query')
  .requiredOption('-s, --symbol <symbol>', 'Trading pair symbol (e.g., BTC/USDT)')
  .option('--json', 'Output in JSON format')
  .action(async options => {
    await executeCommand(async () => {
      const exchange = validateExchange(options.exchange);
      const symbol = validateSymbol(options.symbol);

      try {
        const connector = await ExchangeFactory.getExchange(exchange);
        const ticker = await connector.getTicker(symbol);

        if (options.json) {
          console.log(JSON.stringify(ticker, null, 2));
        } else {
          const [base, quote] = ticker.symbol.split('/');
          console.log(`\n${chalk.bold.cyan(`${ticker.symbol} Ticker`)}:`);
          console.log(`  Last Price:        ${chalk.bold.green('$' + ticker.last.toFixed(8))}`);
          console.log(`  Bid Price:         ${chalk.green('$' + ticker.bid.toFixed(8))}`);
          console.log(`  Ask Price:         ${chalk.red('$' + ticker.ask.toFixed(8))}`);
          console.log(
            `  Spread:            ${chalk.yellow('$' + (ticker.ask - ticker.bid).toFixed(8))}`
          );
          console.log(
            `  24h Volume (${base}):   ${chalk.blue(ticker.baseVolume.toLocaleString())}`
          );
          if (ticker.quoteVolume) {
            console.log(
              `  24h Volume (${quote}):   ${chalk.blue('$' + ticker.quoteVolume.toLocaleString())}`
            );
          }
          console.log(`  Updated:           ${new Date(ticker.timestamp).toLocaleString()}`);
        }
      } catch (error) {
        handleError(error as Error, 'Ticker Query');
      }
    }, 'ticker command');
  });

tickerCommand.addHelpText(
  'after',
  `
Examples:
  $ openmm ticker --exchange mexc --symbol BTC/USDT        # Get BTC/USDT ticker
  $ openmm ticker --exchange mexc --symbol ETH/USDT --json # Get ticker in JSON format
`
);
