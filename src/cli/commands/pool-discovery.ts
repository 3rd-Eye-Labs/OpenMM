import { Command } from 'commander';
import { PoolDiscoveryCLI } from '../pool-discovery-core';
import { executeCommand } from '../utils/error-handler';
import { getSupportedTokens } from '../../config/price-aggregation';

export const poolDiscoveryCommand = new Command('pool-discovery')
  .description('Discover Cardano liquidity pools for native tokens')
  .addCommand(
    new Command('discover')
      .description('Discover pools for a supported token')
      .argument('<token>', 'Token symbol (e.g., NIGHT, SNEK, INDY)')
      .option('--limit <number>', 'Limit number of pools shown', '10')
      .option('--min-liquidity <number>', 'Filter pools by minimum TVL')
      .option('--show-all', 'Show all pools (ignore limit)')
      .option('--json', 'Output in JSON format')
      .action(async (token, options) => {
        await executeCommand(async () => {
          const cli = new PoolDiscoveryCLI();
          const discoverOptions = {
            limit: parseInt(options.limit),
            minLiquidity: options.minLiquidity ? parseInt(options.minLiquidity) : undefined,
            showAll: options.showAll || false,
            json: options.json || false,
          };

          const result = await cli.discoverTokenPools(token, discoverOptions);
          if (options.json) {
            console.log(JSON.stringify(result, null, 2));
          } else {
            cli.displayResults(result);
          }
        }, 'pool-discovery discover');
      })
  )
  .addCommand(
    new Command('supported').description('List all supported tokens').action(async () => {
      await executeCommand(async () => {
        console.log('🎯 Supported Tokens:');
        console.log('─'.repeat(20));
        getSupportedTokens().forEach(token => {
          console.log(`• ${token}`);
        });
      }, 'pool-discovery supported');
    })
  )
  .addCommand(
    new Command('prices')
      .description('Get live prices for token pools')
      .argument('<token>', 'Token symbol')
      .option('--json', 'Output in JSON format')
      .action(async (token, options) => {
        await executeCommand(async () => {
          const cli = new PoolDiscoveryCLI();
          const json = options.json || false;
          const result = await cli.discoverTokenPools(token, { limit: 3, json });
          await cli.getPoolPrices(result.recommendedIdentifiers, token, json);
        }, 'pool-discovery prices');
      })
  )
  .addCommand(
    new Command('custom')
      .description('Generate configuration for custom token')
      .argument('<policyId>', 'Cardano policy ID')
      .argument('<assetNameHex>', 'Asset name in hex format')
      .argument('<symbol>', 'Token symbol')
      .action(async (policyId, assetNameHex, symbol) => {
        await executeCommand(async () => {
          const cli = new PoolDiscoveryCLI();
          cli.suggestTokenConfig(policyId, assetNameHex, symbol);
        }, 'pool-discovery custom');
      })
  );
