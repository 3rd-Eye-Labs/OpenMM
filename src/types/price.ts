/**
 * Price Aggregation Types
 * Universal price service supporting any token pair across multiple exchanges
 */

export interface PriceSource {
  id: string;
  name: string;
  exchange: string;
  reliability: number;        // 0-1 reliability score
  latency: number;           // Average latency in ms
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
  price: number;              // Final aggregated price
  confidence: number;         // 0-1 confidence score
  timestamp: Date;
  sources: PriceSource[];     // Sources used in calculation
  spread: number;            // Price spread across sources
  staleness: number;         // Age of oldest price in seconds
}

export interface PriceCalculation {
  directPrice?: PriceData;    // Direct INDY/USDT if available
  calculatedPrice?: {         // Calculated via ADA/USDT × INDY/ADA
    adaUsdt: PriceData;
    indyAda: PriceData;
    result: number;
  };
  fallbackPrice?: PriceData;  // Emergency fallback price
}

/**
 * Price aggregation configuration
 */
export interface PriceAggregatorConfig {
  sources: PriceSource[];
  updateInterval: number;     // Price update interval in ms
  staleThreshold: number;     // Consider price stale after X seconds
  minSources: number;         // Minimum sources required for aggregation
  maxSpread: number;          // Maximum allowed spread between sources
  fallbackEnabled: boolean;   // Enable fallback pricing for missing pairs
}

/**
 * Cardano native token price calculation
 */
export interface CardanoTokenPricing {
  baseToken: string;          // e.g., "INDY"
  quoteToken: string;         // e.g., "USDT"
  bridgeToken: string;        // "ADA" for calculation bridge
  calculation: {
    bridgeToQuote: PriceData; // ADA/USDT
    baseTokenToBridge: PriceData; // INDY/ADA
  };
}