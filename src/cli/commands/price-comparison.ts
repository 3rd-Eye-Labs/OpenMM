import { Command } from 'commander';
import { MultiExchangePriceService } from '../../core/price-aggregation/multi-exchange-price-service';
import { CardanoPriceService } from '../../core/price-aggregation';
import { executeCommand } from '../utils/error-handler';
import { isTokenSupported } from '../../config/price-aggregation';
import chalk from 'chalk';

export const priceComparisonCommand = new Command('price-comparison')
  .description('Compare token prices across multiple exchanges and DEX')
  .requiredOption('-s, --symbol <symbol>', 'Token symbol to compare (SNEK, INDY)')
  .option('--exchanges-only', 'Only show CEX prices, skip DEX comparison')
  .option('--json', 'Output in JSON format')

  .action(async options => {
    await executeCommand(async () => {
      const { symbol, exchangesOnly, json } = options;
      const symbolUpper = symbol.toUpperCase();

      const multiExchangeService = new MultiExchangePriceService();

      if (exchangesOnly) {
        const aggregatedPrice = await multiExchangeService.getAggregatedPrice(
          `${symbolUpper}/USDT`
        );

        if (json) {
          console.log(JSON.stringify(aggregatedPrice, null, 2));
          return;
        }

        displayCEXPrices(aggregatedPrice);
        return;
      }

      if (!isTokenSupported(symbolUpper)) {
        console.log(
          chalk.yellow(
            `⚠️  ${symbolUpper} not supported for DEX pricing, showing CEX prices only\n`
          )
        );

        const aggregatedPrice = await multiExchangeService.getAggregatedPrice(
          `${symbolUpper}/USDT`
        );

        if (json) {
          console.log(JSON.stringify({ cexOnly: true, aggregatedPrice }, null, 2));
          return;
        }

        displayCEXPrices(aggregatedPrice);
        return;
      }

      console.log(chalk.blue(`\n📊 Fetching ${symbolUpper} prices from all sources...\n`));

      const [dexPrice, cexAggregated] = await Promise.all([
        new CardanoPriceService().getTokenPrice(symbolUpper),
        multiExchangeService.getAggregatedPrice(`${symbolUpper}/USDT`),
      ]);

      if (json) {
        const comparison = await multiExchangeService.compareDEXvsCEXPrices(
          `${symbolUpper}/USDT`,
          dexPrice.price
        );
        console.log(JSON.stringify({ dexPrice, cexAggregated, comparison }, null, 2));
        return;
      }

      displayDEXPrice(symbolUpper, dexPrice);
      displayCEXPrices(cexAggregated);

      const availableCexPrices = cexAggregated.prices.filter(p => p.available);
      if (availableCexPrices.length > 0 && cexAggregated.averagePrice) {
        displayDEXvsCEXComparison(dexPrice.price, cexAggregated.averagePrice);
      }
    }, 'price comparison');
  });

function displayDEXPrice(symbol: string, dexPrice: any) {
  console.log(chalk.blue(`🏊 ${symbol} DEX Price (Cardano Pools)`));
  console.log(`  Price:      $${dexPrice.price.toFixed(8)}`);
  console.log(`  Confidence: ${(dexPrice.confidence * 100).toFixed(1)}%`);
  console.log(`  Sources:    ${dexPrice.sources.length} DEX pools`);
  console.log(`  Updated:    ${dexPrice.timestamp.toLocaleString()}\n`);
}

function displayCEXPrices(aggregated: any) {
  console.log(chalk.green('🏪 CEX Prices'));

  aggregated.prices.forEach((price: any) => {
    if (price.available) {
      console.log(chalk.green(`  ✅ ${price.exchange.toUpperCase()}: $${price.price.toFixed(8)}`));
    } else {
      console.log(chalk.gray(`  ❌ ${price.exchange.toUpperCase()}: Not available`));
    }
  });

  if (aggregated.averagePrice) {
    console.log(chalk.cyan(`  📊 Average CEX Price: $${aggregated.averagePrice.toFixed(8)}`));
  }

  console.log('');
}

function displayDEXvsCEXComparison(dexPrice: number, avgCexPrice: number) {
  const priceDiff = ((dexPrice - avgCexPrice) / avgCexPrice) * 100;

  console.log(chalk.blue('🆚 DEX vs CEX Comparison'));
  console.log(`  DEX Price:     $${dexPrice.toFixed(8)}`);
  console.log(`  CEX Avg Price: $${avgCexPrice.toFixed(8)}`);

  if (priceDiff > 0) {
    console.log(chalk.green(`  DEX Premium:   +${priceDiff.toFixed(2)}% (DEX higher)`));
  } else {
    console.log(chalk.red(`  DEX Discount:  ${priceDiff.toFixed(2)}% (DEX lower)`));
  }
}

priceComparisonCommand.addHelpText(
  'after',
  `
Examples:
  $ openmm price-comparison --symbol SNEK                    # Compare SNEK prices across DEX and CEX
  $ openmm price-comparison --symbol INDY --exchanges-only   # Only CEX prices for INDY
  $ openmm price-comparison --symbol SNEK --json             # JSON output

Note: Compares prices from Cardano DEX pools and centralized exchanges
      CEX prices are fetched from MEXC, Gate.io, and Bitget (where available)
`
);
