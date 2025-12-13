/**
 * Pool Discovery Core Logic
 * Core functionality for discovering Cardano liquidity pools
 */

import { IrisPoolDiscovery } from '../core/price-aggregation';
import { IrisApiClient } from '../core/price-aggregation';
import { CardanoPriceService } from '../core/price-aggregation';
import { getTokenConfig, isTokenSupported, getSupportedTokens } from '../config/price-aggregation';
import { CardanoTokenConfig } from '../types';

export interface PoolInfo {
  identifier: string;
  dex: string;
  tvl: number;
  reserveA: number;
  reserveB: number;
  address: string;
  isActive: boolean;
}

export interface DiscoveryResult {
  token: string;
  policyId: string;
  assetName: string;
  totalPools: number;
  totalLiquidity: number;
  pools: PoolInfo[];
  recommendedIdentifiers: string[];
}

export class PoolDiscoveryCLI {
  private poolDiscovery: IrisPoolDiscovery;
  private irisClient: IrisApiClient;
  private priceService: CardanoPriceService;

  constructor() {
    this.poolDiscovery = new IrisPoolDiscovery();
    this.irisClient = new IrisApiClient();
    this.priceService = new CardanoPriceService();
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
  async getPoolPrices(identifiers: string[], tokenSymbol: string): Promise<void> {
    if (identifiers.length === 0) {
      console.log('❌ No pool identifiers provided');
      return;
    }

    console.log('\n💰 Getting live prices from Iris API...');
    
    try {
      const prices = await this.irisClient.fetchPrices(identifiers, 'OpenMM-PoolDiscovery/1.0');
      
      console.log('─'.repeat(60));
      console.log('Pool ID                           | Price (ADA)');
      console.log('─'.repeat(60));
      
      identifiers.forEach((id, index) => {
        const price = prices[index] || 0;
        const shortId = id.substring(0, 33).padEnd(33);
        console.log(`${shortId} | ${price.toFixed(8)}`);
      });

      const avgAdaPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      console.log('─'.repeat(60));
      console.log(`Average Price: ${avgAdaPrice.toFixed(8)} ADA per ${tokenSymbol}`);

      try {
        console.log('\n💵 Getting full market price...');
        const aggregatedPrice = await this.priceService.getTokenPrice(tokenSymbol);
        
        console.log('─'.repeat(60));
        console.log(`${tokenSymbol}/USDT Price: $${aggregatedPrice.price.toFixed(8)}`);
        console.log(`Confidence: ${(aggregatedPrice.confidence * 100).toFixed(1)}%`);
        console.log(`Sources: ${aggregatedPrice.sources.map(s => s.name).join(', ')}`);
        console.log(`Updated: ${aggregatedPrice.timestamp.toLocaleString()}`);
        
      } catch (usdtError) {
        console.log(`❌ Fa iled to get USDT price: ${usdtError}`);
        console.log(`✅ ADA price available: ${avgAdaPrice.toFixed(8)} ADA per ${tokenSymbol}`);
      }
      
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