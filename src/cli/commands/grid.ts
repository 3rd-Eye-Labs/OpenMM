import { Command } from 'commander';
import { ExchangeFactory } from '../exchange-factory';
import { executeCommand, handleError } from '../utils/error-handler';
import { StrategyFactory } from '../../core/strategy/strategy-factory';
import { LauncherConfig, GridLauncherParams } from '../../config/launcher-config';
import { BaseStrategy } from '../../core/strategy/base-strategy';
import chalk from 'chalk';

export const gridCommand = new Command('grid')
  .description('Start grid trading strategy on specified exchange and symbol')
  .requiredOption('-e, --exchange <exchange>', 'Exchange to trade on (mexc)')
  .requiredOption('-s, --symbol <symbol>', 'Trading pair (INDYUSDT, INDY/USDT, BTCUSDT, etc.)')
  .option('--levels <number>', 'Number of grid levels each side', '5')
  .option('--spacing <decimal>', 'Spacing between levels as decimal (0.02 = 2%)', '0.02')
  .option('--size <number>', 'Order size in quote currency', '50')
  .option('--confidence <decimal>', 'Minimum price confidence (0.6 = 60%)', '0.6')
  .option('--deviation <decimal>', 'Price deviation threshold (0.015 = 1.5%)', '0.015')
  .option('--debounce <ms>', 'Adjustment debounce time in ms', '2000')
  .option('--max-position <decimal>', 'Maximum position size as % of balance (0.8 = 80%)', '0.8')
  .option('--safety-reserve <decimal>', 'Safety reserve as % of balance (0.2 = 20%)', '0.2')
  .option('--dry-run', 'Simulate trading without placing real orders')
  .action(async (options) => {
    let strategy: BaseStrategy | null = null;
    
    const shutdown = async (signal: string) => {
      console.log(chalk.yellow(`\n${signal} received. Stopping grid strategy...`));
      if (strategy) {
        try {
          await strategy.stop();
          console.log(chalk.green('Grid strategy stopped successfully.'));
        } catch (error) {
          console.error(chalk.red('Error stopping strategy:'), error);
        }
      }
      await ExchangeFactory.disconnectAll();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    await executeCommand(async () => {
      try {
        console.log(chalk.blue('🚀 Starting Grid Trading Strategy'));
        console.log(chalk.gray(`Exchange: ${options.exchange.toUpperCase()}`));
        console.log(chalk.gray(`Symbol: ${options.symbol.toUpperCase()}`));
        console.log(chalk.gray(`Grid Levels: ${options.levels} each side`));
        console.log(chalk.gray(`Grid Spacing: ${(parseFloat(options.spacing) * 100).toFixed(1)}%`));
        console.log(chalk.gray(`Order Size: $${options.size}`));
        console.log(chalk.gray(`Max Position: ${(parseFloat(options.maxPosition) * 100).toFixed(0)}%`));
        console.log(chalk.gray(`Safety Reserve: ${(parseFloat(options.safetyReserve) * 100).toFixed(0)}%`));
        
        if (options.dryRun) {
          console.log(chalk.yellow('⚠️  DRY RUN MODE - No real orders will be placed'));
        }

        const config: LauncherConfig = {
          strategy: 'grid',
          exchange: options.exchange,
          symbol: options.symbol
        };
        
        const params: GridLauncherParams = {
          gridLevels: parseInt(options.levels),
          gridSpacing: parseFloat(options.spacing),
          orderSize: parseFloat(options.size),
          minConfidence: parseFloat(options.confidence),
          priceDeviationThreshold: parseFloat(options.deviation),
          adjustmentDebounce: parseInt(options.debounce),
          maxPositionSize: parseFloat(options.maxPosition),
          safetyReservePercentage: parseFloat(options.safetyReserve)
        };
        
        strategy = await StrategyFactory.create(config, params);

        console.log(chalk.green('✅ Grid strategy initialized successfully'));
        
        console.log(chalk.blue('🔄 Starting grid strategy...'));
        await strategy.start();
        
        console.log(chalk.green('✅ Grid strategy is now running!'));
        console.log(chalk.gray('Press Ctrl+C to stop the strategy gracefully'));
        
        await new Promise(() => {});
        
      } catch (error) {
        handleError(error as Error, 'Grid Strategy');
      }
    }, 'grid strategy');
  });


gridCommand.addHelpText('after', `
Examples:
  $ openmm grid --exchange mexc --symbol INDYUSDT                         # Start INDY/USDT grid with defaults
  $ openmm grid --exchange mexc --symbol INDY/USDT --levels 7 --size 100  # Custom parameters
  $ openmm grid --exchange mexc --symbol BTCUSDT --spacing 0.015          # BTC grid with 1.5% spacing
  $ openmm grid --exchange mexc --symbol INDYUSDT --dry-run               # Test mode (no real orders)

Grid Strategy Parameters:
  --levels: Number of buy and sell orders each side (default: 5, range: 1-20)
  --spacing: Price spacing between grid levels (default: 0.02 = 2%)
  --size: Order size in quote currency like USDT (default: 50)
  --confidence: Minimum price confidence to trade (default: 0.6 = 60%)
  --deviation: Price movement % to trigger grid recreation (default: 0.015 = 1.5%)
  --debounce: Delay between grid adjustments in ms (default: 2000ms)
  --max-position: Maximum position size as % of balance (default: 0.8 = 80%)
  --safety-reserve: Safety reserve as % of balance (default: 0.2 = 20%)

Note: Ensure MEXC_API_KEY and MEXC_SECRET_KEY environment variables are set.
`);