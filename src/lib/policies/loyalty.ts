/**
 * Single source of truth for loyalty tier thresholds and points calculation.
 */

export type LoyaltyTier = 'Silver' | 'Gold' | 'Platinum';

export const SPENDING_TIER_ORDER: readonly LoyaltyTier[] = ['Silver', 'Gold', 'Platinum'];

export const SPENDING_TIER_THRESHOLDS: Readonly<Record<LoyaltyTier, number>> = {
  Silver: 0,
  Gold: 5_000_000,
  Platinum: 10_000_000,
};

export const POINT_TIER_THRESHOLDS: Readonly<Record<LoyaltyTier, number>> = {
  Silver: 0,
  Gold: 5_000,
  Platinum: 10_000,
};

export const RUPIAH_PER_SPENDING_POINT = 10_000;
export const RUPIAH_PER_LOYALTY_POINT = 1_000;

export function getLoyaltyTierFromPoints(totalPoints: number): LoyaltyTier {
  if (totalPoints >= POINT_TIER_THRESHOLDS.Platinum) return 'Platinum';
  if (totalPoints >= POINT_TIER_THRESHOLDS.Gold) return 'Gold';
  return 'Silver';
}

export function computeMemberTierFromSpending(totalSpending: number): LoyaltyTier {
  if (totalSpending >= SPENDING_TIER_THRESHOLDS.Platinum) return 'Platinum';
  if (totalSpending >= SPENDING_TIER_THRESHOLDS.Gold) return 'Gold';
  return 'Silver';
}

export function getNextSpendingTier(currentTier: LoyaltyTier): LoyaltyTier | null {
  const index = SPENDING_TIER_ORDER.indexOf(currentTier);
  return SPENDING_TIER_ORDER[index + 1] ?? null;
}

export function getSpendingTierThreshold(tier: LoyaltyTier): number {
  return SPENDING_TIER_THRESHOLDS[tier];
}

export function calculateSpendingPoints(amountRupiah: number): number {
  return Math.floor(amountRupiah / RUPIAH_PER_SPENDING_POINT);
}

export function calculateLoyaltyPoints(amountRupiah: number): number {
  return Math.floor(amountRupiah / RUPIAH_PER_LOYALTY_POINT);
}
