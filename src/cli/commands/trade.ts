import { Command } from 'commander';
import { ExchangeFactory } from '../exchange-factory';
import { executeCommand, handleError } from '../utils/error-handler';
import { StrategyFactory } from '../../core/strategy/strategy-factory';
import { LauncherConfig, GridLauncherParams } from '../../config/launcher-config';
import { BaseStrategy } from '../../core/strategy/base-strategy';
import chalk from 'chalk';

export const tradeCommand = new Command('trade')
  .description('Start trading with specified strategy and parameters')
  .requiredOption('-s, --strategy <strategy>', 'Trading strategy to use (grid)')
  .requiredOption('-e, --exchange <exchange>', 'Exchange to trade on (mexc, bitget)')
  .requiredOption('--symbol <symbol>', 'Trading pair (INDYUSDT, INDY/USDT, BTCUSDT, etc.)')
  
  .option('--levels <number>', 'Grid: Number of levels each side (default: 5)', '5')
  .option('--spacing <decimal>', 'Grid: Spacing between levels as decimal (0.02 = 2%)', '0.02')
  .option('--size <number>', 'Grid: Order size in quote currency (default: 50)', '50')
  .option('--confidence <decimal>', 'Grid: Minimum price confidence (0.6 = 60%)', '0.6')
  .option('--deviation <decimal>', 'Grid: Price deviation threshold (0.015 = 1.5%)', '0.015')
  .option('--debounce <ms>', 'Grid: Adjustment debounce time in ms (default: 2000)', '2000')
  .option('--max-position <decimal>', 'Grid: Maximum position size as % of balance (0.8 = 80%)', '0.8')
  .option('--safety-reserve <decimal>', 'Grid: Safety reserve as % of balance (0.2 = 20%)', '0.2')
  
  .option('--dry-run', 'Simulate trading without placing real orders')
  
  .action(async (options) => {
    let strategy: BaseStrategy | null = null;
    
    const shutdown = async (signal: string) => {
      console.log(chalk.yellow(`\n${signal} received. Stopping strategy...`));
      if (strategy) {
        try {
          await strategy.stop();
          console.log(chalk.green('Strategy stopped successfully.'));
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
      const strategyType = options.strategy.toLowerCase();
      
      try {
        console.log(chalk.blue('🚀 Starting Trading Strategy'));
        console.log(chalk.gray(`Strategy: ${options.strategy.toUpperCase()}`));
        console.log(chalk.gray(`Exchange: ${options.exchange.toUpperCase()}`));
        console.log(chalk.gray(`Symbol: ${options.symbol.toUpperCase()}`));
        
        if (options.dryRun) {
          console.log(chalk.yellow('⚠️  DRY RUN MODE - No real orders will be placed'));
        }

        const config: LauncherConfig = {
          strategy: strategyType,
          exchange: options.exchange,
          symbol: options.symbol
        };
        
        let params: any = {};
        
        if (strategyType === 'grid') {
          console.log(chalk.gray(`Grid Levels: ${options.levels} each side`));
          console.log(chalk.gray(`Grid Spacing: ${(parseFloat(options.spacing) * 100).toFixed(1)}%`));
          console.log(chalk.gray(`Order Size: $${options.size}`));
          console.log(chalk.gray(`Max Position: ${(parseFloat(options.maxPosition) * 100).toFixed(0)}%`));
          console.log(chalk.gray(`Safety Reserve: ${(parseFloat(options.safetyReserve) * 100).toFixed(0)}%`));
          
          params = {
            gridLevels: parseInt(options.levels),
            gridSpacing: parseFloat(options.spacing),
            orderSize: parseFloat(options.size),
            minConfidence: parseFloat(options.confidence),
            priceDeviationThreshold: parseFloat(options.deviation),
            adjustmentDebounce: parseInt(options.debounce),
            maxPositionSize: parseFloat(options.maxPosition),
            safetyReservePercentage: parseFloat(options.safetyReserve)
          } as GridLauncherParams;
        }
        
        console.log(chalk.blue('⚙️  Creating strategy...'));
        strategy = await StrategyFactory.create(config, params);
        
        console.log(chalk.green('✅ Strategy initialized successfully'));
        
        console.log(chalk.blue('🔄 Starting strategy...'));
        await strategy.start();
        
        console.log(chalk.green('✅ Strategy is now running!'));
        console.log(chalk.gray('Press Ctrl+C to stop the strategy gracefully'));
        
        await new Promise(() => {});
        
      } catch (error) {
        handleError(error as Error, 'Trading Strategy');
      }
    }, 'trading strategy');
  });

tradeCommand.addHelpText('after', `
Examples:
  $ openmm trade --strategy grid --exchange mexc --symbol INDYUSDT                    # Start INDY/USDT grid with defaults
  $ openmm trade --strategy grid --exchange bitget --symbol SNEK/USDT --levels 7     # Bitget SNEK/USDT grid
  $ openmm trade --strategy grid --exchange mexc --symbol INDY/USDT --levels 7 --size 100  # Custom parameters
  $ openmm trade --strategy grid --exchange bitget --symbol BTCUSDT --spacing 0.015  # BTC grid with 1.5% spacing
  $ openmm trade --strategy grid --exchange mexc --symbol INDYUSDT --dry-run         # Test mode (no real orders)

Grid Strategy Parameters:
  --levels: Number of buy and sell orders each side (default: 5, range: 1-20)
  --spacing: Price spacing between grid levels (default: 0.02 = 2%)
  --size: Order size in quote currency like USDT (default: 50)
  --confidence: Minimum price confidence to trade (default: 0.6 = 60%)
  --deviation: Price movement % to trigger grid recreation (default: 0.015 = 1.5%)
  --debounce: Delay between grid adjustments in ms (default: 2000ms)
  --max-position: Maximum position size as % of balance (default: 0.8 = 80%)
  --safety-reserve: Safety reserve as % of balance (default: 0.2 = 20%)

Note: Ensure exchange-specific environment variables are set:
  - MEXC: MEXC_API_KEY and MEXC_SECRET_KEY
  - Bitget: BITGET_API_KEY, BITGET_SECRET, and BITGET_PASSPHRASE
`);