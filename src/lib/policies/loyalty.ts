/**
 * Single source of truth for loyalty tier thresholds and points calculation.
 */

export type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export const SPENDING_TIER_THRESHOLDS: Readonly<Record<Exclude<LoyaltyTier, 'Bronze'>, number>> = {
  Silver: 1_000_000,
  Gold: 5_000_000,
  Platinum: 10_000_000,
};

export const POINT_TIER_THRESHOLDS: Readonly<Record<Exclude<LoyaltyTier, 'Bronze'>, number>> = {
  Silver: 1_000,
  Gold: 5_000,
  Platinum: 10_000,
};

export const RUPIAH_PER_SPENDING_POINT = 10_000;
export const RUPIAH_PER_LOYALTY_POINT = 1_000;

export function getLoyaltyTierFromPoints(totalPoints: number): LoyaltyTier {
  if (totalPoints >= POINT_TIER_THRESHOLDS.Platinum) return 'Platinum';
  if (totalPoints >= POINT_TIER_THRESHOLDS.Gold) return 'Gold';
  if (totalPoints >= POINT_TIER_THRESHOLDS.Silver) return 'Silver';
  return 'Bronze';
}

export function computeMemberTierFromSpending(totalSpending: number): LoyaltyTier {
  if (totalSpending >= SPENDING_TIER_THRESHOLDS.Platinum) return 'Platinum';
  if (totalSpending >= SPENDING_TIER_THRESHOLDS.Gold) return 'Gold';
  if (totalSpending >= SPENDING_TIER_THRESHOLDS.Silver) return 'Silver';
  return 'Bronze';
}

export function calculateSpendingPoints(amountRupiah: number): number {
  return Math.floor(amountRupiah / RUPIAH_PER_SPENDING_POINT);
}

export function calculateLoyaltyPoints(amountRupiah: number): number {
  return Math.floor(amountRupiah / RUPIAH_PER_LOYALTY_POINT);
}
