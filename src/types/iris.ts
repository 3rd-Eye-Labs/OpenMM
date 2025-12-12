/**
 * Iris API Types
 * Types specific to Iris protocol integration for Cardano DEX aggregation
 */

/**
 * Token information from Iris API
 */
export interface IrisToken {
  policyId: string | null;
  nameHex: string;
  decimals?: number;
  isLpToken?: boolean;
  meta?: string;
  name?: string;
  ticker?: string;
}

/**
 * Liquidity pool from Iris API
 */
export interface LiquidityPool {
  dex: string;
  identifier: string;
  address?: string;
  orderAddress?: string;
  pair?: {
    tokenA: IrisToken | null;
    tokenB: IrisToken | null;
  };
  state?: {
    tvl: number;
    reserveA: number;
    reserveB: number;
    price?: number;
    liquidityProvider?: string;
  };
  createdSlot?: number;
  lastUpdated?: Date;
  isActive?: boolean;
}

/**
 * Iris API response structure
 */
export interface IrisApiResponse {
  pools: LiquidityPool[];
  timestamp: number;
  status: 'success' | 'error';
}

/**
 * Price calculation result with metadata
 */
export interface PriceCalculationResult {
  price: number;
  confidence: number;
  poolsUsed: number;
  totalLiquidity: number;
  timestamp: Date;
}