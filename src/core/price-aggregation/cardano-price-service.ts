/**
 * Cardano Price Service
 * Aggregates Cardano native-token prices from independent DEX providers.
 */

import { AggregatedPrice, PriceData } from '../../types';
import { CEX_API_CONFIG, getTokenConfig, isTokenSupported } from '../../config/price-aggregation';
import { logger } from '../../utils';
import { CardanoDexPriceProvider, CardanoDexPriceQuote } from './cardano-dex-price-provider';
import { MinswapPriceProvider } from './minswap-price-provider';
import { SundaeSwapPriceProvider } from './sundaeswap-price-provider';

interface TokenAdaResult {
  price: number;
  confidence: number;
  quotes: CardanoDexPriceQuote[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class CardanoPriceService {
  private readonly providers: CardanoDexPriceProvider[];

  constructor(
    providers: CardanoDexPriceProvider[] = [
      new MinswapPriceProvider(),
      new SundaeSwapPriceProvider(),
    ]
  ) {
    this.providers = providers;
  }

  /**
   * Gets TOKEN/USDT price via ADA bridge: ADA/USDT × TOKEN/ADA.
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
      if (!Number.isFinite(finalPrice) || finalPrice <= 0) {
        throw new Error(`Invalid non-finite ${symbol}/USDT price`);
      }
      logger.info(`Final ${symbol}/USDT price: ${finalPrice.toFixed(8)}`);

      const dexSources = tokenAdaResult.quotes.map(quote => ({
        id: quote.provider,
        name: quote.provider === 'minswap' ? 'Minswap' : 'SundaeSwap',
        exchange: 'cardano',
        reliability: quote.provider === 'minswap' ? 0.9 : 0.85,
        latency: 0,
        isActive: true,
      }));

      return {
        symbol: `${symbol}/USDT`,
        price: finalPrice,
        confidence: tokenAdaResult.confidence,
        timestamp: new Date(),
        sources: [
          ...dexSources,
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
      throw new Error(`Price aggregation failed for ${symbol}: ${errorMessage(error)}`);
    }
  }

  private async getTokenADAPrice(symbol: string): Promise<TokenAdaResult> {
    const tokenConfig = getTokenConfig(symbol);
    const results = await Promise.all(
      this.providers.map(async provider => {
        try {
          const quote = await provider.getTokenAdaQuote(tokenConfig);
          if (
            !Number.isFinite(quote.priceAda) ||
            quote.priceAda <= 0 ||
            !Number.isFinite(quote.liquidityAda) ||
            quote.liquidityAda <= 0
          ) {
            throw new Error('invalid non-positive price or liquidity');
          }
          return { provider, quote, error: null };
        } catch (error) {
          return { provider, quote: null, error: errorMessage(error) };
        }
      })
    );

    const quotes = results
      .map(result => result.quote)
      .filter((quote): quote is CardanoDexPriceQuote => quote !== null);
    if (quotes.length === 0) {
      const failures = results
        .map(result => `${result.provider.id}: ${result.error ?? 'no valid quote'}`)
        .join('; ');
      throw new Error(`Cardano DEX providers unavailable for ${symbol}: ${failures}`);
    }

    const maximumLiquidity = Math.max(...quotes.map(quote => quote.liquidityAda));
    let scaledLiquidity = 0;
    let price = 0;

    for (const quote of quotes) {
      const weight = quote.liquidityAda / maximumLiquidity;
      const nextLiquidity = scaledLiquidity + weight;
      price += (quote.priceAda - price) * (weight / nextLiquidity);
      scaledLiquidity = nextLiquidity;
    }

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`Cardano DEX providers returned a non-finite price for ${symbol}`);
    }
    const confidence = this.calculateDexConfidence(quotes);

    logger.info(
      `${symbol}/ADA price: ${price.toFixed(8)} from ${quotes
        .map(quote => quote.provider)
        .join(', ')}`
    );

    return { price, confidence, quotes };
  }

  private calculateDexConfidence(quotes: CardanoDexPriceQuote[]): number {
    if (quotes.length === 1) {
      return 0.7;
    }

    const prices = quotes.map(quote => quote.priceAda);
    const minimum = Math.min(...prices);
    const maximum = Math.max(...prices);
    const midpoint = minimum / 2 + maximum / 2;
    const relativeSpread = midpoint > 0 ? (maximum - minimum) / midpoint : 1;
    const materialSpread = Math.max(0, relativeSpread - 0.1);

    return Math.max(0.7, 0.9 - Math.min(0.2, materialSpread * 0.25));
  }

  /**
   * Get ADA/USDT price from multiple CEX sources with fallback.
   * Uses Binance, MEXC, CoinGecko, and Kraken for robust pricing.
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
      throw new Error(`Failed to get ADA/USDT price: ${errorMessage(error)}`);
    }
  }

  /** Fetch ADA/USDT price from one exchange. */
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
