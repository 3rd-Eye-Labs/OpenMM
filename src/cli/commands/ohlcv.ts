import { Command } from 'commander';
import chalk from 'chalk';
import { ExchangeFactory } from '../exchange-factory';
import { validateExchange, validateSymbol } from '../utils/validation';
import { executeCommand, handleError } from '../utils/error-handler';
import { OHLCVTimeframe } from '../../types';

const VALID_TIMEFRAMES: OHLCVTimeframe[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];

function validateTimeframe(timeframe: string): OHLCVTimeframe {
  if (!VALID_TIMEFRAMES.includes(timeframe as OHLCVTimeframe)) {
    console.error(chalk.red(`❌ Invalid timeframe: ${timeframe}`));
    console.log(chalk.yellow(`Valid timeframes: ${VALID_TIMEFRAMES.join(', ')}`));
    process.exit(1);
  }
  return timeframe as OHLCVTimeframe;
}

export const ohlcvCommand = new Command('ohlcv')
  .description('Get historical OHLCV (candlestick) data for a trading pair')
  .requiredOption('-e, --exchange <exchange>', 'Exchange to query')
  .requiredOption('-s, --symbol <symbol>', 'Trading pair symbol (e.g., BTC/USDT)')
  .option('-t, --timeframe <timeframe>', 'Candle timeframe (1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w)', '1h')
  .option('-l, --limit <limit>', 'Number of candles to fetch (default: 100, max: 1000)', '100')
  .option('--json', 'Output in JSON format')
  .action(async options => {
    await executeCommand(async () => {
      const exchange = validateExchange(options.exchange);
      const symbol = validateSymbol(options.symbol);
      const timeframe = validateTimeframe(options.timeframe);
      const limit = parseInt(options.limit);

      if (isNaN(limit) || limit <= 0) {
        console.error(chalk.red('❌ Limit must be a positive number'));
        process.exit(1);
      }

      if (limit > 1000) {
        console.error(chalk.red('❌ Limit cannot exceed 1000'));
        process.exit(1);
      }

      try {
        const connector = await ExchangeFactory.getExchange(exchange);
        const ohlcv = await connector.getOHLCV(symbol, timeframe, limit);

        if (options.json) {
          console.log(JSON.stringify(ohlcv, null, 2));
        } else {
          if (ohlcv.length === 0) {
            console.log(chalk.yellow(`No OHLCV data found for ${symbol}`));
            return;
          }

          console.log(
            `\n${chalk.bold.cyan(`${symbol} OHLCV Data`)} (${timeframe}, ${ohlcv.length} candles):`
          );

          console.log(
            chalk.gray(
              'Date/Time            │ Open         │ High         │ Low          │ Close        │ Volume'
            )
          );
          console.log(
            chalk.gray(
              '─────────────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────'
            )
          );

          // Show last 20 candles in table format, or all if less than 20
          const displayCandles = ohlcv.slice(-20);

          displayCandles.forEach(candle => {
            const date = new Date(candle.timestamp).toLocaleString('en-US', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            });
            const dateStr = date.padEnd(20);
            const open = candle.open.toFixed(8).padStart(12);
            const high = candle.high.toFixed(8).padStart(12);
            const low = candle.low.toFixed(8).padStart(12);
            const close = candle.close.toFixed(8).padStart(12);
            const volume = candle.volume.toLocaleString(undefined, { maximumFractionDigits: 2 }).padStart(12);

            // Color based on candle direction
            const priceColor = candle.close >= candle.open ? chalk.green : chalk.red;

            console.log(
              `${dateStr} │ ${priceColor(open)} │ ${priceColor(high)} │ ${priceColor(low)} │ ${priceColor(close)} │ ${chalk.blue(volume)}`
            );
          });

          // Summary stats
          const latestCandle = ohlcv[ohlcv.length - 1];
          const oldestCandle = ohlcv[0];
          const highestHigh = Math.max(...ohlcv.map(c => c.high));
          const lowestLow = Math.min(...ohlcv.map(c => c.low));
          const totalVolume = ohlcv.reduce((sum, c) => sum + c.volume, 0);
          const priceChange = latestCandle.close - oldestCandle.open;
          const priceChangePercent = (priceChange / oldestCandle.open) * 100;

          console.log(`\n${chalk.bold('Summary')}:`);
          console.log(`  Period:        ${new Date(oldestCandle.timestamp).toLocaleString()} - ${new Date(latestCandle.timestamp).toLocaleString()}`);
          console.log(`  Highest High:  ${chalk.green('$' + highestHigh.toFixed(8))}`);
          console.log(`  Lowest Low:    ${chalk.red('$' + lowestLow.toFixed(8))}`);
          console.log(`  Total Volume:  ${chalk.blue(totalVolume.toLocaleString(undefined, { maximumFractionDigits: 2 }))}`);
          
          const changeColor = priceChange >= 0 ? chalk.green : chalk.red;
          const changeSign = priceChange >= 0 ? '+' : '';
          console.log(
            `  Price Change:  ${changeColor(changeSign + priceChange.toFixed(8) + ' (' + changeSign + priceChangePercent.toFixed(2) + '%)')}`
          );
        }
      } catch (error) {
        handleError(error as Error, 'OHLCV Query');
      }
    }, 'ohlcv command');
  });

ohlcvCommand.addHelpText(
  'after',
  `
Examples:
  $ openmm ohlcv --exchange mexc --symbol BTC/USDT                      # Get 100 hourly candles
  $ openmm ohlcv --exchange mexc --symbol BTC/USDT --timeframe 1h --limit 500
  $ openmm ohlcv --exchange kraken --symbol BTC/USD --timeframe 1d --limit 100 --json
  $ openmm ohlcv -e gateio -s ETH/USDT -t 4h -l 200

Supported Timeframes:
  1m   - 1 minute
  5m   - 5 minutes
  15m  - 15 minutes
  30m  - 30 minutes
  1h   - 1 hour
  4h   - 4 hours
  1d   - 1 day
  1w   - 1 week
`
);
