import { Command } from 'commander';
import chalk from 'chalk';
import { ExchangeFactory } from '../exchange-factory';
import { validateExchange, validateSymbol } from '../utils/validation';
import { executeCommand, handleError } from '../utils/error-handler';

export const orderbookCommand = new Command('orderbook')
  .description('Get order book data for a trading pair')
  .alias('book')
  .requiredOption('-e, --exchange <exchange>', 'Exchange to query')
  .requiredOption('-s, --symbol <symbol>', 'Trading pair symbol (e.g., BTC/USDT)')
  .option('-l, --limit <limit>', 'Number of bid/ask levels to display (default: 10)', '10')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
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
        const orderbook = await connector.getOrderBook(symbol);

        if (options.json) {
          const limitedOrderbook = {
            ...orderbook,
            bids: orderbook.bids.slice(0, limit),
            asks: orderbook.asks.slice(0, limit)
          };
          console.log(JSON.stringify(limitedOrderbook, null, 2));
        } else {
          console.log(`\n${chalk.bold.cyan(`${orderbook.symbol} Order Book`)}:`);
          console.log(`Updated: ${new Date(orderbook.timestamp).toLocaleString()}\n`);

          // Display asks (highest to lowest price)
          const asks = orderbook.asks.slice(0, limit).reverse();
          console.log(chalk.bold.red('  ASKS (Sell Orders)'));
          console.log(chalk.gray('  Price        │ Amount       │ Total'));
          console.log(chalk.gray('  ─────────────┼──────────────┼──────────────'));
          
          asks.forEach(ask => {
            const price = ask.price.toFixed(8).padStart(12);
            const amount = ask.amount.toFixed(8).padStart(12);
            const total = (ask.price * ask.amount).toFixed(8).padStart(12);
            console.log(chalk.red(`  ${price} │ ${amount} │ ${total}`));
          });

          // Spread
          if (orderbook.asks.length > 0 && orderbook.bids.length > 0) {
            const spread = orderbook.asks[0].price - orderbook.bids[0].price;
            const spreadPercent = ((spread / orderbook.asks[0].price) * 100).toFixed(4);
            console.log(chalk.yellow(`\n  Spread: $${spread.toFixed(8)} (${spreadPercent}%)\n`));
          }

          // Display bids (highest to lowest price)
          const bids = orderbook.bids.slice(0, limit);
          console.log(chalk.bold.green('  BIDS (Buy Orders)'));
          console.log(chalk.gray('  Price        │ Amount       │ Total'));
          console.log(chalk.gray('  ─────────────┼──────────────┼──────────────'));
          
          bids.forEach(bid => {
            const price = bid.price.toFixed(8).padStart(12);
            const amount = bid.amount.toFixed(8).padStart(12);
            const total = (bid.price * bid.amount).toFixed(8).padStart(12);
            console.log(chalk.green(`  ${price} │ ${amount} │ ${total}`));
          });
        }
      } catch (error) {
        handleError(error as Error, 'Order Book Query');
      }
    }, 'orderbook command');
  });

orderbookCommand.addHelpText('after', `
Examples:
  $ openmm orderbook --exchange mexc --symbol BTC/USDT           # Get order book with 10 levels
  $ openmm orderbook --exchange mexc --symbol BTC/USDT --limit 5 # Get order book with 5 levels
  $ openmm book --exchange mexc --symbol ETH/USDT --json         # Get order book in JSON format
`);