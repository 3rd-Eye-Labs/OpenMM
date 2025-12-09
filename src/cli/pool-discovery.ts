#!/usr/bin/env node

/**
 * Pool Discovery CLI
 * Command-line tool to discover Cardano liquidity pool identifiers and metrics
 * for any native token to be used in Market Making strategies
 */

import { IrisPoolDiscovery } from '../core/price-aggregation';
import { IrisApiClient } from '../core/price-aggregation';
import { getTokenConfig, isTokenSupported, getSupportedTokens } from '../config/price-aggregation';
import { CardanoTokenConfig } from '../types/price';

interface PoolInfo {
  identifier: string;
  dex: string;
  tvl: number;
  reserveA: number;
  reserveB: number;
  address: string;
  isActive: boolean;
}

interface DiscoveryResult {
  token: string;
  policyId: string;
  assetName: string;
  totalPools: number;
  totalLiquidity: number;
  pools: PoolInfo[];
  recommendedIdentifiers: string[];
}

class PoolDiscoveryCLI {
  private poolDiscovery: IrisPoolDiscovery;
  private irisClient: IrisApiClient;

  constructor() {
    this.poolDiscovery = new IrisPoolDiscovery();
    this.irisClient = new IrisApiClient();
  }

  /**
   * Main discovery function for any Cardano native token
   */
  async discoverTokenPools(tokenSymbol: string, options: {
    limit?: number;
    minLiquidity?: number;
    showAll?: boolean;
  } = {}): Promise<DiscoveryResult> {
    const symbol = tokenSymbol.toUpperCase();
    
    if (!isTokenSupported(symbol)) {
      throw new Error(`Unsupported token: ${symbol}. Supported tokens: ${getSupportedTokens().join(', ')}`);
    }

    const tokenConfig = getTokenConfig(symbol);
    const { limit = 10, minLiquidity, showAll = false } = options;

    console.log(`🔍 Discovering liquidity pools for ${symbol} token...`);
    console.log(`Policy ID: ${tokenConfig.policyId}`);
    console.log(`Asset Name (hex): ${tokenConfig.assetName}`);
    console.log('─'.repeat(80));

    try {
      const pools = await this.poolDiscovery.discoverPools('lovelace', tokenConfig);
      
      const filteredPools = minLiquidity
        ? pools.filter(pool => Number(pool.state?.tvl || 0) >= minLiquidity)
        : pools;

      const sortedPools = filteredPools
        .sort((a, b) => Number(b.state?.tvl || 0) - Number(a.state?.tvl || 0))
        .slice(0, showAll ? filteredPools.length : limit);

      const totalLiquidity = pools.reduce((sum, pool) => 
        sum + Number(pool.state?.tvl || 0), 0);

      const poolInfos: PoolInfo[] = sortedPools.map(pool => ({
        identifier: pool.identifier || 'N/A',
        dex: pool.dex || 'Unknown',
        tvl: Number(pool.state?.tvl || 0),
        reserveA: Number(pool.state?.reserveA || 0),
        reserveB: Number(pool.state?.reserveB || 0),
        address: pool.address || 'N/A',
        isActive: pool.isActive || false
      }));

      const recommendedIdentifiers = poolInfos
        .slice(0, 3)
        .filter(pool => pool.isActive)
        .map(pool => pool.identifier);

      return {
        token: symbol,
        policyId: tokenConfig.policyId,
        assetName: tokenConfig.assetName,
        totalPools: pools.length,
        totalLiquidity,
        pools: poolInfos,
        recommendedIdentifiers
      };

    } catch (error) {
      throw new Error(`Pool discovery failed for ${symbol}: ${error}`);
    }
  }

  /**
   * Display discovery results in a formatted table
   */
  displayResults(result: DiscoveryResult): void {
    console.log(`\n📊 ${result.token} Liquidity Pool Discovery Results`);
    console.log('═'.repeat(80));
    
    console.log(`Total Pools Found: ${result.totalPools}`);
    console.log(`Total Liquidity: ${this.formatCurrency(result.totalLiquidity)}`);
    console.log(`Token Policy ID: ${result.policyId}`);
    console.log(`Asset Name (hex): ${result.assetName}`);
    
    if (result.pools.length === 0) {
      console.log('\n❌ No liquidity pools found for this token.');
      return;
    }

    console.log('\n🏊 Pool Details:');
    console.log('─'.repeat(80));
    console.log('Rank | DEX          | TVL          | Identifier                    | Active');
    console.log('─'.repeat(80));

    result.pools.forEach((pool, index) => {
      const rank = `${index + 1}`.padStart(4);
      const dex = pool.dex.substring(0, 12).padEnd(12);
      const tvl = this.formatCurrency(pool.tvl).padStart(12);
      const identifier = pool.identifier.substring(0, 29).padEnd(29);
      const status = pool.isActive ? '✅' : '❌';
      
      console.log(`${rank} | ${dex} | ${tvl} | ${identifier} | ${status}`);
    });

    console.log('\n🎯 Recommended Pool Identifiers for Market Making:');
    console.log('─'.repeat(60));
    
    if (result.recommendedIdentifiers.length === 0) {
      console.log('❌ No active pools with sufficient liquidity found.');
    } else {
      result.recommendedIdentifiers.forEach((id, index) => {
        const pool = result.pools.find(p => p.identifier === id);
        console.log(`${index + 1}. ${id}`);
        console.log(`   DEX: ${pool?.dex}, TVL: ${this.formatCurrency(pool?.tvl || 0)}`);
      });
    }

    console.log('\n💡 Usage Instructions:');
    console.log('─'.repeat(40));
    console.log('1. Use the recommended pool identifiers in your market making strategy');
    console.log('2. Higher TVL pools typically offer better price stability');
    console.log('3. Monitor multiple pools for price aggregation and arbitrage opportunities');
    console.log(`4. Current minimum liquidity threshold: ${this.formatCurrency(getTokenConfig(result.token).minLiquidityThreshold || 0)}`);
  }

  /**
   * Get live price information for discovered pools
   */
  async getPoolPrices(identifiers: string[]): Promise<void> {
    if (identifiers.length === 0) {
      console.log('❌ No pool identifiers provided');
      return;
    }

    console.log('\n💰 Getting live prices from Iris API...');
    
    try {
      const prices = await this.irisClient.fetchPrices(identifiers, 'OpenMM-PoolDiscovery/1.0');
      
      console.log('─'.repeat(50));
      console.log('Pool ID                           | Price (ADA)');
      console.log('─'.repeat(50));
      
      identifiers.forEach((id, index) => {
        const price = prices[index] || 0;
        const shortId = id.substring(0, 33).padEnd(33);
        console.log(`${shortId} | ${price.toFixed(8)}`);
      });

      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      console.log('─'.repeat(50));
      console.log(`Average Price: ${avgPrice.toFixed(8)} ADA per token`);
      
    } catch (error) {
      console.log(`❌ Failed to fetch prices: ${error}`);
    }
  }


  /**
   * Format currency with K/M suffixes
   */
  private formatCurrency(amount: number): string {
    if (amount === 0) return '$0';
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    }
    return `$${amount.toFixed(0)}`;
  }

  /**
   * Add a new token configuration (for advanced users)
   */
  suggestTokenConfig(policyId: string, assetNameHex: string, symbol: string): CardanoTokenConfig {
    console.log('\n🔧 Token Configuration for Custom Token:');
    console.log('─'.repeat(50));
    console.log(`Symbol: ${symbol.toUpperCase()}`);
    console.log(`Policy ID: ${policyId}`);
    console.log(`Asset Name (hex): ${assetNameHex}`);
    console.log('\nAdd this to your src/config/price-aggregation.ts:');
    console.log('─'.repeat(50));
    console.log(`'${symbol.toUpperCase()}': {`);
    console.log(`  symbol: '${symbol.toUpperCase()}',`);
    console.log(`  policyId: '${policyId}',`);
    console.log(`  assetName: '${assetNameHex}',`);
    console.log(`  minLiquidityThreshold: 25000 // Adjust as needed`);
    console.log(`}`);

    return {
      symbol: symbol.toUpperCase(),
      policyId,
      assetName: assetNameHex,
      minLiquidityThreshold: 25000
    };
  }
}

/**
 * CLI Entry Point
 */
async function main() {
  const args = process.argv.slice(2);
  const cli = new PoolDiscoveryCLI();

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('🔍 OpenMM Pool Discovery CLI');
    console.log('═'.repeat(40));
    console.log('Usage: npm run pool-discovery <command> [options]');
    console.log('\nCommands:');
    console.log('  discover <TOKEN>     Discover pools for a supported token');
    console.log('  supported           List all supported tokens');
    console.log('  prices <TOKEN>      Get live prices for token pools');
    console.log('  custom <POLICY> <HEX> <SYMBOL>  Generate config for custom token');
    console.log('\nOptions:');
    console.log('  --limit <N>         Limit number of pools shown (default: 10)');
    console.log('  --min-liquidity <N> Filter pools by minimum TVL');
    console.log('  --show-all          Show all pools (ignore limit)');
    console.log('\nExamples:');
    console.log('  npm run pool-discovery discover NIGHT');
    console.log('  npm run pool-discovery discover SNEK --limit 5');
    console.log('  npm run pool-discovery discover INDY --min-liquidity 100000');
    console.log('  npm run pool-discovery prices NIGHT');
    console.log('  npm run pool-discovery supported');
    return;
  }

  const command = args[0];

  try {
    switch (command) {
      case 'discover': {
        if (args.length < 2) {
          console.log('❌ Token symbol required. Usage: npm run pool-discovery discover <TOKEN>');
          return;
        }

        const token = args[1];
        const options: any = {};

        for (let i = 2; i < args.length; i += 2) {
          switch (args[i]) {
            case '--limit':
              options.limit = parseInt(args[i + 1]);
              break;
            case '--min-liquidity':
              options.minLiquidity = parseInt(args[i + 1]);
              break;
            case '--show-all':
              options.showAll = true;
              i--;
              break;
          }
        }

        const result = await cli.discoverTokenPools(token, options);
        cli.displayResults(result);
        break;
      }

      case 'supported': {
        console.log('🎯 Supported Tokens:');
        console.log('─'.repeat(20));
        getSupportedTokens().forEach(token => {
          const config = getTokenConfig(token);
          console.log(`${token} (Min Liquidity: ${cli['formatCurrency'](config.minLiquidityThreshold || 0)})`);
        });
        break;
      }

      case 'prices': {
        if (args.length < 2) {
          console.log('❌ Token symbol required. Usage: npm run pool-discovery prices <TOKEN>');
          return;
        }

        const token = args[1];
        const result = await cli.discoverTokenPools(token, { limit: 3 });
        await cli.getPoolPrices(result.recommendedIdentifiers);
        break;
      }

      case 'custom': {
        if (args.length < 4) {
          console.log('❌ Usage: npm run pool-discovery custom <POLICY_ID> <ASSET_NAME_HEX> <SYMBOL>');
          return;
        }

        const [, policyId, assetNameHex, symbol] = args;
        cli.suggestTokenConfig(policyId, assetNameHex, symbol);
        break;
      }

      default:
        console.log(`❌ Unknown command: ${command}`);
        console.log('Run "npm run pool-discovery --help" for usage information.');
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { PoolDiscoveryCLI, DiscoveryResult, PoolInfo };