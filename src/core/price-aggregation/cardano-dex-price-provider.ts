import { CardanoTokenConfig } from '../../types';

export interface CardanoDexPriceQuote {
  provider: 'minswap' | 'sundaeswap';
  priceAda: number;
  liquidityAda: number;
  poolsUsed: number;
  timestamp: Date;
}

export interface CardanoDexPriceProvider {
  readonly id: CardanoDexPriceQuote['provider'];
  getTokenAdaQuote(token: CardanoTokenConfig): Promise<CardanoDexPriceQuote>;
}
