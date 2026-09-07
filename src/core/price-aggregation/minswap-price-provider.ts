import { CARDANO_DEX_API_CONFIG } from '../../config/price-aggregation';
import { CardanoTokenConfig } from '../../types';
import { CardanoDexPriceProvider, CardanoDexPriceQuote } from './cardano-dex-price-provider';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function positiveNumber(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return null;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export class MinswapPriceProvider implements CardanoDexPriceProvider {
  readonly id = 'minswap' as const;

  async getTokenAdaQuote(token: CardanoTokenConfig): Promise<CardanoDexPriceQuote> {
    const assetId = `${token.policyId}${token.assetName}`;
    const url = `${CARDANO_DEX_API_CONFIG.MINSWAP.BASE_URL}/v1/assets/${assetId}/metrics`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CARDANO_DEX_API_CONFIG.MINSWAP.TIMEOUT);

    let response: Response;
    try {
      response = await fetch(url, { method: 'GET', signal: controller.signal });
    } catch (error) {
      clearTimeout(timeout);
      throw new Error(`Minswap price API network error: ${errorMessage(error)}`);
    }

    if (!response.ok) {
      clearTimeout(timeout);
      throw new Error(`Minswap price API HTTP error: ${response.status}`);
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch (error) {
      clearTimeout(timeout);
      throw new Error(`Minswap price API schema error: ${errorMessage(error)}`);
    }
    clearTimeout(timeout);

    const metrics = data as { price?: unknown; liquidity?: unknown } | null;
    const priceAda = positiveNumber(metrics?.price);
    const liquidityAda = positiveNumber(metrics?.liquidity);

    if (!metrics || priceAda === null || liquidityAda === null) {
      throw new Error('Minswap price API schema error: expected positive price and liquidity');
    }

    return {
      provider: this.id,
      priceAda,
      liquidityAda,
      poolsUsed: 1,
      timestamp: new Date(),
    };
  }
}
