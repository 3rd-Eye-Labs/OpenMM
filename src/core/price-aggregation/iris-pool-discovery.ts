/**
 * Iris Pool Discovery
 * Handles automatic discovery and ranking of liquidity pools via Iris API
 */

import { LiquidityPool } from '../../types';
import { CardanoTokenConfig } from '../../types';
import { IrisApiClient } from './iris-api-client';

export class IrisPoolDiscovery {
  private irisClient: IrisApiClient;

  constructor() {
    this.irisClient = new IrisApiClient();
  }

  /**
   * Discover and rank pools for a given token pair
   * Sort by liquidity (TVL)
   */
  async discoverPools(
    baseAsset: string,
    tokenConfig: CardanoTokenConfig
  ): Promise<LiquidityPool[]> {
    try {
      const pools = await this.fetchPoolsFromIris(baseAsset, tokenConfig);

      if (pools.length === 0) {
        throw new Error(`No liquidity pools found for ${tokenConfig.symbol}`);
      }

      const sortedPools = pools.sort(
        (a, b) => Number(b.state?.tvl ?? 0) - Number(a.state?.tvl ?? 0)
      );

      const filteredPools = tokenConfig.minLiquidityThreshold
        ? sortedPools.filter(
            pool => Number(pool.state?.tvl ?? 0) >= tokenConfig.minLiquidityThreshold!
          )
        : sortedPools;

      if (filteredPools.length === 0) {
        throw new Error(
          `No pools meet minimum liquidity threshold for ${tokenConfig.symbol} ` +
            `(minimum: ${tokenConfig.minLiquidityThreshold})`
        );
      }

      return filteredPools;
    } catch (error) {
      throw new Error(`Pool discovery failed for ${tokenConfig.symbol}: ${error}`);
    }
  }

  /**
   * Fetch liquidity pools from Iris API
   * Updated to work with actual API format: /api/liquidity-pools
   */
  private async fetchPoolsFromIris(
    baseAsset: string,
    tokenConfig: CardanoTokenConfig
  ): Promise<LiquidityPool[]> {
    const allPools = await this.irisClient.fetchLiquidityPools();
    return this.filterPoolsByToken(allPools, baseAsset, tokenConfig);
  }

  /**
   * Filter pools to find those matching the specified token pair
   */
  private filterPoolsByToken(
    pools: any[],
    baseAsset: string,
    tokenConfig: CardanoTokenConfig
  ): LiquidityPool[] {
    const matchingPools: LiquidityPool[] = [];

    for (const pool of pools) {
      const hasTargetToken = this.poolContainsToken(pool, tokenConfig);
      const hasBaseAsset = this.poolContainsBaseAsset(pool, baseAsset);

      if (hasTargetToken && hasBaseAsset) {
        const liquidityPool = this.convertToLiquidityPool(pool);
        if (liquidityPool) {
          matchingPools.push(liquidityPool);
        }
      }
    }

    return matchingPools;
  }

  /**
   * Check if pool contains the target token
   */
  private poolContainsToken(pool: any, tokenConfig: CardanoTokenConfig): boolean {
    if (pool.tokenB && pool.tokenB.policyId === tokenConfig.policyId) {
      const nameHex = pool.tokenB.nameHex?.toLowerCase();
      const targetNameHex = tokenConfig.assetName.toLowerCase();
      return nameHex === targetNameHex;
    }

    if (pool.tokenA && pool.tokenA.policyId === tokenConfig.policyId) {
      const nameHex = pool.tokenA.nameHex?.toLowerCase();
      const targetNameHex = tokenConfig.assetName.toLowerCase();
      return nameHex === targetNameHex;
    }

    return false;
  }

  /**
   * Check if pool contains the base asset (usually ADA/lovelace)
   */
  private poolContainsBaseAsset(pool: any, baseAsset: string): boolean {
    if (baseAsset === 'lovelace') {
      return pool.tokenA === null;
    }

    return (
      (pool.tokenA && pool.tokenA.policyId === baseAsset) ||
      (pool.tokenB && pool.tokenB.policyId === baseAsset)
    );
  }

  /**
   * Convert Iris API pool format to our LiquidityPool interface
   */
  private convertToLiquidityPool(pool: any): LiquidityPool | null {
    try {
      const tvl = pool.state?.tvl || 0;
      const reserveA = pool.state?.reserveA || 0;
      const reserveB = pool.state?.reserveB || 0;

      return {
        identifier: pool.identifier || '',
        dex: pool.dex || 'unknown',
        address: pool.address || '',
        pair: {
          tokenA: pool.tokenA || { symbol: 'ADA', policyId: null },
          tokenB: pool.tokenB || { symbol: 'Unknown', policyId: null },
        },
        state: {
          tvl,
          reserveA,
          reserveB,
          price: reserveB > 0 && reserveA > 0 ? reserveA / reserveB : 0,
          liquidityProvider: pool.state?.liquidityProvider || 'unknown',
        },
        createdSlot: pool.createdSlot || 0,
        lastUpdated: new Date(),
        isActive: tvl > 0 && reserveA > 0 && reserveB > 0,
      };
    } catch (error) {
      console.warn('Failed to convert pool:', pool, error);
      return null;
    }
  }
}
