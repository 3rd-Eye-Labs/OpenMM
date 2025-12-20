import { Command } from 'commander';
import chalk from 'chalk';
import { ExchangeFactory } from '../exchange-factory';
import { validateExchange, validateSymbol } from '../utils/validation';
import { executeCommand, handleError } from '../utils/error-handler';

export const tradesCommand = new Command('trades')
  .description('Get recent trades for a trading pair')
  .requiredOption('-e, --exchange <exchange>', 'Exchange to query')
  .requiredOption('-s, --symbol <symbol>', 'Trading pair symbol (e.g., BTC/USDT)')
  .option('-l, --limit <limit>', 'Number of trades to display (default: 20)', '20')
  .option('--json', 'Output in JSON format')
  .action(async options => {
    await executeCommand(async () => {
      const exchange = validateExchange(options.exchange);
      const symbol = validateSymbol(options.symbol);
      const limit = parseInt(options.limit);

      if (isNaN(limit) || limit <= 0) {
        console.error(chalk.red('❌ Limit must be a positive number'));
        process.exit(1);
      }

      try {
        const connector = await ExchangeFactory.getExchange(exchange);
        const trades = await connector.getRecentTrades(symbol);

        const limitedTrades = trades.slice(0, limit);

        if (options.json) {
          console.log(JSON.stringify(limitedTrades, null, 2));
        } else {
          if (limitedTrades.length === 0) {
            console.log(chalk.yellow(`No recent trades found for ${symbol}`));
            return;
          }

          console.log(
            `\n${chalk.bold.cyan(`Recent Trades for ${symbol}`)} (Latest ${limitedTrades.length}):`
          );

          console.log(
            chalk.gray('ID       │ Side │ Price        │ Amount       │ Total        │ Time')
          );
          console.log(
            chalk.gray(
              '─────────┼──────┼──────────────┼──────────────┼──────────────┼─────────────'
            )
          );

          limitedTrades.forEach(trade => {
            const id = trade.id.padEnd(8);
            const side = trade.side === 'buy' ? chalk.green('BUY ') : chalk.red('SELL');
            const price = `$${trade.price.toFixed(8)}`.padEnd(13);
            const amount = trade.amount.toFixed(8).padEnd(13);
            const total = `$${(trade.price * trade.amount).toFixed(8)}`.padEnd(13);
            const time = new Date(trade.timestamp).toLocaleTimeString().padEnd(11);

            console.log(`${id} │ ${side} │ ${price} │ ${amount} │ ${total} │ ${time}`);
          });

          const buyTrades = limitedTrades.filter(t => t.side === 'buy');
          const sellTrades = limitedTrades.filter(t => t.side === 'sell');
          const totalVolume = limitedTrades.reduce(
            (sum, trade) => sum + trade.price * trade.amount,
            0
          );

          console.log(`\n${chalk.bold('Summary')}:`);
          console.log(`  Total Trades:  ${limitedTrades.length}`);
          console.log(`  Buy Trades:    ${chalk.green(buyTrades.length)}`);
          console.log(`  Sell Trades:   ${chalk.red(sellTrades.length)}`);
          console.log(
            `  Total Volume:  ${chalk.blue('$' + totalVolume.toLocaleString(undefined, { maximumFractionDigits: 2 }))}`
          );
        }
      } catch (error) {
        handleError(error as Error, 'Recent Trades Query');
      }
    }, 'trades command');
  });

tradesCommand.addHelpText(
  'after',
  `
Examples:
  $ openmm trades --exchange mexc --symbol BTC/USDT              # Get 20 recent trades
  $ openmm trades --exchange mexc --symbol BTC/USDT --limit 50   # Get 50 recent trades
  $ openmm trades --exchange mexc --symbol ETH/USDT --json       # Get trades in JSON format
`
);
