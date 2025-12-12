/**
 * Price Aggregation Types
 * Universal price service supporting any token pair across multiple exchanges
 */

export interface PriceSource {
  id: string;
  name: string;
  exchange: string;
  reliability: number;
  latency: number;
  isActive: boolean;
}

export interface PriceData {
  symbol: string;
  price: number;
  timestamp: Date;
  source: string;
  volume24h?: number;
  change24h?: number;
}

export interface AggregatedPrice {
  symbol: string;
  price: number;
  confidence: number;
  timestamp: Date;
  sources: PriceSource[];
}

/**
 * Cardano token configuration for price aggregation
 */
export interface CardanoTokenConfig {
  symbol: string;
  policyId: string;
  assetName: string;
  minLiquidityThreshold?: number;
}
