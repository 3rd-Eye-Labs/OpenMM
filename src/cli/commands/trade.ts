import { Command } from 'commander';
import { ExchangeFactory } from '../exchange-factory';
import { executeCommand, handleError } from '../utils/error-handler';
import { StrategyFactory } from '../../core/strategy/strategy-factory';
import { LauncherConfig, GridLauncherParams } from '../../config/launcher-config';
import { BaseStrategy } from '../../core/strategy/base-strategy';
import { SpacingModel, SizeModel } from '../../types';
import chalk from 'chalk';

export const tradeCommand = new Command('trade')
  .description('Start trading with specified strategy and parameters')
  .requiredOption('-s, --strategy <strategy>', 'Trading strategy to use (grid)')
  .requiredOption(
    '-e, --exchange <exchange>',
    'Exchange to trade on (mexc, bitget, gateio, kraken)'
  )
  .requiredOption('--symbol <symbol>', 'Trading pair (INDYUSDT, INDY/USDT, BTCUSDT, etc.)')

  .option('--levels <number>', 'Grid: Number of levels each side (default: 5)', '5')
  .option('--spacing <decimal>', 'Grid: Spacing between levels as decimal (0.02 = 2%)', '0.02')
  .option('--size <number>', 'Grid: Order size in quote currency (default: 50)', '50')
  .option('--confidence <decimal>', 'Grid: Minimum price confidence (0.6 = 60%)', '0.6')
  .option('--deviation <decimal>', 'Grid: Price deviation threshold (0.015 = 1.5%)', '0.015')
  .option('--debounce <ms>', 'Grid: Adjustment debounce time in ms (default: 2000)', '2000')
  .option(
    '--max-position <decimal>',
    'Grid: Maximum position size as % of balance (0.8 = 80%)',
    '0.8'
  )
  .option('--safety-reserve <decimal>', 'Grid: Safety reserve as % of balance (0.2 = 20%)', '0.2')

  // Dynamic grid options
  .option(
    '--spacing-model <model>',
    'Grid: Spacing model - linear, geometric, or custom (default: linear)',
    'linear'
  )
  .option(
    '--spacing-factor <number>',
    'Grid: Geometric spacing multiplier per level (default: 1.3)'
  )
  .option(
    '--size-model <model>',
    'Grid: Size distribution - flat, pyramidal, or custom (default: flat)',
    'flat'
  )
  .option('--grid-profile <path>', 'Grid: Load full grid configuration from a JSON profile file')

  // Volatility options
  .option('--volatility', 'Grid: Enable volatility-based dynamic spread adjustment')
  .option('--volatility-low <decimal>', 'Grid: Low volatility threshold (default: 0.02 = 2%)')
  .option('--volatility-high <decimal>', 'Grid: High volatility threshold (default: 0.05 = 5%)')

  .option('--dry-run', 'Simulate trading without placing real orders')

  .action(async options => {
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
          symbol: options.symbol,
        };

        let params: any = {};

        if (strategyType === 'grid') {
          const spacingModel = options.spacingModel as SpacingModel;
          const sizeModel = options.sizeModel as SizeModel;

          if (!['linear', 'geometric', 'custom'].includes(spacingModel)) {
            throw new Error(
              `Invalid spacing model: ${spacingModel}. Must be: linear, geometric, or custom`
            );
          }

          if (!['flat', 'pyramidal', 'custom'].includes(sizeModel)) {
            throw new Error(
              `Invalid size model: ${sizeModel}. Must be: flat, pyramidal, or custom`
            );
          }

          // Validate levels (1-10 per side)
          const levels = parseInt(options.levels);
          if (levels < 1 || levels > 10) {
            throw new Error(`Grid levels must be between 1 and 10, got ${levels}`);
          }

          console.log(chalk.gray(`Grid Levels: ${options.levels} per side (${levels * 2} total)`));
          console.log(
            chalk.gray(`Grid Spacing: ${(parseFloat(options.spacing) * 100).toFixed(1)}%`)
          );
          console.log(chalk.gray(`Spacing Model: ${spacingModel}`));
          if (spacingModel === 'geometric' && options.spacingFactor) {
            console.log(chalk.gray(`Spacing Factor: ${options.spacingFactor}`));
          }
          console.log(chalk.gray(`Size Model: ${sizeModel}`));
          console.log(chalk.gray(`Order Size: $${options.size}`));
          console.log(
            chalk.gray(`Max Position: ${(parseFloat(options.maxPosition) * 100).toFixed(0)}%`)
          );
          console.log(
            chalk.gray(`Safety Reserve: ${(parseFloat(options.safetyReserve) * 100).toFixed(0)}%`)
          );

          if (options.gridProfile) {
            console.log(chalk.gray(`Grid Profile: ${options.gridProfile}`));
          }

          if (options.volatility) {
            const lowThreshold = options.volatilityLow ? parseFloat(options.volatilityLow) : 0.02;
            const highThreshold = options.volatilityHigh
              ? parseFloat(options.volatilityHigh)
              : 0.05;
            console.log(chalk.gray(`Volatility Tracking: enabled`));
            console.log(
              chalk.gray(
                `Volatility Thresholds: ${(lowThreshold * 100).toFixed(1)}% / ${(highThreshold * 100).toFixed(1)}%`
              )
            );
          }

          params = {
            gridLevels: levels,
            gridSpacing: parseFloat(options.spacing),
            orderSize: parseFloat(options.size),
            minConfidence: parseFloat(options.confidence),
            priceDeviationThreshold: parseFloat(options.deviation),
            adjustmentDebounce: parseInt(options.debounce),
            maxPositionSize: parseFloat(options.maxPosition),
            safetyReservePercentage: parseFloat(options.safetyReserve),
            spacingModel,
            sizeModel,
            spacingFactor: options.spacingFactor ? parseFloat(options.spacingFactor) : undefined,
            gridProfilePath: options.gridProfile,
            volatilityEnabled: !!options.volatility,
            volatilityLowThreshold: options.volatilityLow
              ? parseFloat(options.volatilityLow)
              : undefined,
            volatilityHighThreshold: options.volatilityHigh
              ? parseFloat(options.volatilityHigh)
              : undefined,
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

tradeCommand.addHelpText(
  'after',
  `
Examples:

  # 1. Linear spacing + Flat sizing (default behavior)
  $ openmm trade --strategy grid --exchange kraken --symbol SNEK/EUR --levels 5 --spacing 0.02 --size 5

  # 2. Geometric spacing + Flat sizing
  $ openmm trade --strategy grid --exchange kraken --symbol SNEK/EUR --levels 10 --spacing 0.003 --spacing-model geometric --spacing-factor 1.3 --size 5

  # 3. Geometric spacing + Pyramidal sizing
  $ openmm trade --strategy grid --exchange kraken --symbol SNEK/EUR --levels 10 --spacing 0.005 --spacing-model geometric --spacing-factor 1.5 --size-model pyramidal --size 5

  # 4. Linear spacing + Pyramidal sizing
  $ openmm trade --strategy grid --exchange kraken --symbol SNEK/EUR --levels 8 --spacing 0.01 --size-model pyramidal --size 5

  # 5. Geometric with aggressive factor (wider outer levels)
  $ openmm trade --strategy grid --exchange kraken --symbol SNEK/EUR --levels 10 --spacing 0.002 --spacing-model geometric --spacing-factor 2.0 --size-model pyramidal --size 5

  # 6. Load full configuration from a JSON profile file
  $ openmm trade --strategy grid --exchange gateio --symbol SNEK/USDT --grid-profile ./profiles/aggressive.json

  # 7. Volatility-based dynamic spread adjustment
  $ openmm trade --strategy grid --exchange kraken --symbol SNEK/EUR --levels 5 --spacing 0.01 --size 5 --volatility
  $ openmm trade --strategy grid --exchange kraken --symbol SNEK/EUR --levels 5 --spacing 0.01 --size 5 --volatility --volatility-low 0.01 --volatility-high 0.03

  # 8. Multi-exchange examples
  $ openmm trade --strategy grid --exchange mexc --symbol INDY/USDT --levels 10 --spacing 0.005 --spacing-model geometric --spacing-factor 1.3 --size-model pyramidal --size 5
  $ openmm trade --strategy grid --exchange bitget --symbol SNEK/USDT --levels 7 --spacing 0.01 --size-model pyramidal --size 5
  $ openmm trade --strategy grid --exchange gateio --symbol SNEK/USDT --levels 8 --spacing 0.004 --spacing-model geometric --spacing-factor 1.4 --size-model pyramidal --size 5

Grid Strategy Parameters:
  --levels <number>           Number of buy and sell orders each side (default: 5, max: 10)
  --spacing <decimal>         Base price spacing between grid levels (default: 0.02 = 2%)
  --size <number>             Base order size in quote currency like USDT (default: 50)
  --confidence <decimal>      Minimum price confidence to trade (default: 0.6 = 60%)
  --deviation <decimal>       Price movement % to trigger grid recreation (default: 0.015 = 1.5%)
  --debounce <ms>             Delay between grid adjustments in ms (default: 2000ms)
  --max-position <decimal>    Maximum position size as % of balance (default: 0.8 = 80%)
  --safety-reserve <decimal>  Safety reserve as % of balance (default: 0.2 = 20%)

Dynamic Grid Parameters:
  --spacing-model <model>     How spacing between levels is calculated (default: linear)
                              linear    - Equal spacing between all levels
                              geometric - Spacing increases by factor per level (wider at edges)
                              custom    - User-defined via grid profile file
  --spacing-factor <number>   Geometric spacing multiplier per level (default: 1.3)
                              Example: factor=1.5, base=0.5% → gaps: 0.5%, 0.75%, 1.125%...
  --size-model <model>        How order sizes are distributed across levels (default: flat)
                              flat      - Equal size for all levels
                              pyramidal - Larger sizes near center, smaller at edges
                              custom    - User-defined weights via grid profile file
  --grid-profile <path>       Load complete grid config from JSON file (overrides CLI params)

Volatility Parameters:
  --volatility                Enable volatility-based dynamic spread adjustment (off by default)
  --volatility-low <decimal>  Low volatility threshold (default: 0.02 = 2%)
                              Below this, grid spacing stays normal (multiplier 1.0)
  --volatility-high <decimal> High volatility threshold (default: 0.05 = 5%)
                              Above this, grid spacing is widened maximally (multiplier 2.0)

Grid Profile File Format (JSON):
  {
    "name": "my-profile",
    "levels": 10,
    "spacingModel": "geometric",
    "baseSpacing": 0.005,
    "spacingFactor": 1.3,
    "sizeModel": "pyramidal",
    "baseSize": 50
  }

  For custom spacing/sizing, provide arrays:
  {
    "levels": 5,
    "spacingModel": "custom",
    "customSpacings": [0.005, 0.012, 0.022, 0.035, 0.055],
    "sizeModel": "custom",
    "sizeWeights": [1.5, 1.3, 1.0, 0.8, 0.6],
    "baseSize": 50
  }

Note: Ensure exchange-specific environment variables are set:
  - MEXC: MEXC_API_KEY and MEXC_SECRET_KEY
  - Bitget: BITGET_API_KEY, BITGET_SECRET, and BITGET_PASSPHRASE
  - Gate.io: GATEIO_API_KEY and GATEIO_SECRET
  - Kraken: KRAKEN_API_KEY and KRAKEN_SECRET
`
);
