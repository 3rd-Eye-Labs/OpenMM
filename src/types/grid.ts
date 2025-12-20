export interface GridLevel {
  price: number;
  side: 'buy' | 'sell';
  orderSize: number;
}

export interface GridOrderManagerConfig {
  priceDeviationThreshold: number;
  adjustmentDebounce: number;
}
