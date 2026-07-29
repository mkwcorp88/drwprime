/**
 * Single source of truth for commission calculation.
 */

export const DEFAULT_COMMISSION_RATE = 0.1;

export function calculateCommission(
  price: number,
  rate: number = DEFAULT_COMMISSION_RATE,
): number {
  return Math.round(price * rate * 100) / 100;
}

export function calculateCommissionPoints(commissionAmount: number): number {
  return Math.floor(commissionAmount / 100);
}
