/**
 * Cardano Price Service
 * Main service orchestrating price aggregation for Cardano native tokens
 * Following Phase 1 Iris-only approach with fail-fast error handling
 */

import { AggregatedPrice, PriceData } from '../../types';
import { PriceCalculationResult } from '../../types';
import { IrisPoolDiscovery } from './iris-pool-discovery';
import { IrisApiClient } from './iris-api-client';
import { PriceCalculator } from './price-calculator';
import { CEX_API_CONFIG, getTokenConfig, isTokenSupported } from '../../config/price-aggregation';
import { logger } from '../../utils';

export class CardanoPriceService {
  private poolDiscovery: IrisPoolDiscovery;
  private irisClient: IrisApiClient;
  private priceCalculator: PriceCalculator;

  constructor() {
    this.poolDiscovery = new IrisPoolDiscovery();
    this.irisClient = new IrisApiClient();
    this.priceCalculator = new PriceCalculator();
  }

  /**
   * Main price fetching method
   * Gets TOKEN/USDT price via ADA bridge: ADA/USDT × TOKEN/ADA
   */
  async getTokenPrice(symbol: string): Promise<AggregatedPrice> {
    if (!isTokenSupported(symbol)) {
      throw new Error(`Unsupported token: ${symbol}`);
    }

    try {
      const [adaUsdtPrice, tokenAdaResult] = await Promise.all([
        this.getADAUSDTPrice(),
        this.getTokenADAPrice(symbol),
      ]);

      const finalPrice = adaUsdtPrice.price * tokenAdaResult.price;
      logger.info(`Final ${symbol}/USDT price: ${finalPrice.toFixed(8)}`);

      return {
        symbol: `${symbol}/USDT`,
        price: finalPrice,
        confidence: tokenAdaResult.confidence,
        timestamp: new Date(),
        sources: [
          {
            id: 'iris-dex',
            name: 'Iris DEX Aggregator',
            exchange: 'cardano',
            reliability: 0.9,
            latency: 0,
            isActive: true,
          },
          {
            id: 'cex-ada',
            name: 'CEX ADA/USDT',
            exchange: adaUsdtPrice.source,
            reliability: 0.95,
            latency: 0,
            isActive: true,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Price aggregation failed for ${symbol}: ${error}`);
    }
  }

  /**
   * Get TOKEN/ADA price using Iris prices API
   */
  private async getTokenADAPrice(symbol: string): Promise<PriceCalculationResult> {
    const tokenConfig = getTokenConfig(symbol);

    try {
      const pools = await this.poolDiscovery.discoverPools('lovelace', tokenConfig);

      if (pools.length === 0) {
        throw new Error(`No pools found for ${symbol}`);
      }

      const topPools = pools
        .filter(pool => pool.identifier && pool.state?.tvl)
        .sort((a, b) => Number(b.state!.tvl) - Number(a.state!.tvl))
        .slice(0, 3);

      if (topPools.length === 0) {
        throw new Error(`No valid pools with liquidity found for ${symbol}`);
      }

      const identifiers = topPools.map(pool => pool.identifier!);
      const prices = await this.irisClient.fetchPrices(
        identifiers,
        'OpenMM-CardanoPriceService/1.0'
      );

      const result = this.priceCalculator.calculateLiquidityWeightedPrice(topPools, prices);

      logger.info(
        `${symbol}/ADA price: ${result.price.toFixed(8)} from ${result.poolsUsed} pools (Iris API)`
      );

      return result;
    } catch (error) {
      throw new Error(`Failed to get ${symbol}/ADA price from Iris: ${error}`);
    }
  }

  /**
   * Get ADA/USDT price from multiple CEX sources with fallback
   * Uses Binance, MEXC, Coingecko, and Kraken for robust pricing
   */
  private async getADAUSDTPrice(): Promise<PriceData> {
    try {
      const prices = await Promise.all([
        this.fetchADAUSDT('binance').catch(() => null),
        this.fetchADAUSDT('mexc').catch(() => null),
        this.fetchADAUSDT('coingecko').catch(() => null),
        this.fetchADAUSDT('kraken').catch(() => null),
      ]);

      const validPrices = prices.filter(
        price => price !== null && price > 0 && !isNaN(price)
      ) as number[];

      if (validPrices.length === 0) {
        throw new Error('No valid ADA/USDT price from any source');
      }

      const averagePrice = validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length;

      return {
        symbol: 'ADA/USDT',
        price: averagePrice,
        timestamp: new Date(),
        source: `multi-cex-${validPrices.length}`,
        volume24h: 1000000,
      };
    } catch (error) {
      throw new Error(`Failed to get ADA/USDT price: ${error}`);
    }
  }

  /**
   * Fetch ADA/USDT price from specified exchange
   */
  private async fetchADAUSDT(
    exchange: 'binance' | 'mexc' | 'coingecko' | 'kraken'
  ): Promise<number> {
    let url: string;
    let priceExtractor: (data: any) => number;

    switch (exchange) {
      case 'binance':
        url = `${CEX_API_CONFIG.BINANCE.BASE_URL}${CEX_API_CONFIG.BINANCE.ENDPOINTS.TICKER_PRICE}?symbol=ADAUSDT`;
        priceExtractor = data => parseFloat(data.price);
        break;

      case 'mexc':
        url = `${CEX_API_CONFIG.MEXC.BASE_URL}${CEX_API_CONFIG.MEXC.ENDPOINTS.TICKER_PRICE}?symbol=ADAUSDT`;
        priceExtractor = data => parseFloat(data.price);
        break;

      case 'coingecko':
        url = `${CEX_API_CONFIG.COINGECKO.BASE_URL}${CEX_API_CONFIG.COINGECKO.ENDPOINTS.SIMPLE_PRICE}?ids=cardano&vs_currencies=usd`;
        priceExtractor = data => data?.cardano?.usd;
        break;

      case 'kraken':
        url = `${CEX_API_CONFIG.KRAKEN.BASE_URL}${CEX_API_CONFIG.KRAKEN.ENDPOINTS.TICKER}?pair=ADAUSD`;
        priceExtractor = data => parseFloat(data?.result?.ADAUSD?.c?.[0]);
        break;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${exchange} API error: ${response.status}`);
    }

    const data = await response.json();
    const price = priceExtractor(data);

    if (isNaN(price) || price <= 0 || price == null) {
      throw new Error(`Invalid price from ${exchange}`);
    }

    return price;
  }
}
