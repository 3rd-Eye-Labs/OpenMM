import { CardanoTokenConfig, LiquidityPool } from '../../types';

export interface CardanoPoolProvider {
  readonly id: 'minswap' | 'sundaeswap';
  discoverPools(token: CardanoTokenConfig): Promise<LiquidityPool[]>;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function positiveNumber(value: unknown): number | null {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && value.trim() === '')
  )
    return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
