/**
 * Single source of truth for loyalty tier thresholds and points calculation.
 *
 * After business validation, these thresholds become the authoritative policy.
 * All route handlers and components MUST use these functions — never inline
 * the tier thresholds.
 */

export type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export const TIER_THRESHOLDS: Readonly<Record<LoyaltyTier, number>> = {
  Bronze: 0,
  Silver: 1000,
  Gold: 5000,
  Platinum: 10000,
};

export const RUPIAH_PER_SPENDING_POINT = 10000;
export const RUPIAH_PER_LOYALTY_POINT = 1000;

export function getLoyaltyTier(totalPoints: number): LoyaltyTier {
  if (totalPoints >= TIER_THRESHOLDS.Platinum) return 'Platinum';
  if (totalPoints >= TIER_THRESHOLDS.Gold) return 'Gold';
  if (totalPoints >= TIER_THRESHOLDS.Silver) return 'Silver';
  return 'Bronze';
}

export function calculateSpendingPoints(amountRupiah: number): number {
  return Math.floor(amountRupiah / RUPIAH_PER_SPENDING_POINT);
}

export function calculateLoyaltyPoints(amountRupiah: number): number {
  return Math.floor(amountRupiah / RUPIAH_PER_LOYALTY_POINT);
}

export function getNextTier(currentTier: LoyaltyTier): LoyaltyTier | null {
  const tiers: LoyaltyTier[] = ['Bronze', 'Silver', 'Gold', 'Platinum'];
  const idx = tiers.indexOf(currentTier);
  return idx < tiers.length - 1 ? tiers[idx + 1] : null;
}

export function getNextTierThreshold(currentTier: LoyaltyTier): number | null {
  const next = getNextTier(currentTier);
  return next ? TIER_THRESHOLDS[next] : null;
}
