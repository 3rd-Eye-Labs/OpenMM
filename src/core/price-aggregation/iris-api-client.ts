/**
 * Iris API Client
 * Centralized client for all Iris API interactions
 */

import { IRIS_CONFIG } from '../../config/price-aggregation';

export class IrisApiClient {
  private readonly baseUrl = IRIS_CONFIG.BASE_URL;

  /**
   * Fetch prices from Iris prices API using pool identifiers
   */
  async fetchPrices(
    identifiers: string[],
    userAgent: string = 'OpenMM-PriceAggregator/1.0'
  ): Promise<number[]> {
    const url = `${this.baseUrl}/api/liquidity-pools/prices`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
      },
      body: JSON.stringify({
        identifiers: identifiers,
      }),
    });

    if (!response.ok) {
      throw new Error(`Iris prices API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Invalid response format from Iris prices API');
    }

    return data.map(entry => {
      const price = parseFloat(entry.price);
      if (isNaN(price) || price <= 0) {
        throw new Error(`Invalid price value: ${entry.price}`);
      }
      return price;
    });
  }

  /**
   * Fetch all liquidity pools from Iris API
   */
  async fetchLiquidityPools(userAgent: string = 'OpenMM-PriceAggregator/1.0'): Promise<any[]> {
    const url = `${this.baseUrl}/api/liquidity-pools`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`Iris API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data?.data || [];
  }
}
