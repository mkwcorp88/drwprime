import { describe, it, expect } from 'vitest';
import {
  getLoyaltyTier,
  calculateSpendingPoints,
  calculateLoyaltyPoints,
  TIER_THRESHOLDS,
  type LoyaltyTier,
} from '@/lib/policies/loyalty';
import { calculateCommission } from '@/lib/policies/commission';

describe('Loyalty Tier Policy', () => {
  const testCases: [number, LoyaltyTier][] = [
    [0, 'Bronze'],
    [500, 'Bronze'],
    [999, 'Bronze'],
    [1000, 'Silver'],
    [2000, 'Silver'],
    [4999, 'Silver'],
    [5000, 'Gold'],
    [7500, 'Gold'],
    [9999, 'Gold'],
    [10000, 'Platinum'],
    [50000, 'Platinum'],
  ];

  testCases.forEach(([points, expected]) => {
    it(`${points.toLocaleString()} points = ${expected}`, () => {
      expect(getLoyaltyTier(points)).toBe(expected);
    });
  });
});

describe('TIER_THRESHOLDS constants', () => {
  it('Bronze = 0', () => expect(TIER_THRESHOLDS.Bronze).toBe(0));
  it('Silver = 1000', () => expect(TIER_THRESHOLDS.Silver).toBe(1000));
  it('Gold = 5000', () => expect(TIER_THRESHOLDS.Gold).toBe(5000));
  it('Platinum = 10000', () => expect(TIER_THRESHOLDS.Platinum).toBe(10000));
});

describe('Spending Points Calculation', () => {
  it('Rp 0 = 0 pts', () => expect(calculateSpendingPoints(0)).toBe(0));
  it('Rp 9,999 = 0 pts', () => expect(calculateSpendingPoints(9999)).toBe(0));
  it('Rp 10,000 = 1 pt', () => expect(calculateSpendingPoints(10000)).toBe(1));
  it('Rp 1,500,000 = 150 pts', () => expect(calculateSpendingPoints(1500000)).toBe(150));
});

describe('Loyalty Points Calculation', () => {
  it('Rp 0 = 0 pts', () => expect(calculateLoyaltyPoints(0)).toBe(0));
  it('Rp 500 = 0 pts', () => expect(calculateLoyaltyPoints(500)).toBe(0));
  it('Rp 1,000 = 1 pt', () => expect(calculateLoyaltyPoints(1000)).toBe(1));
  it('Rp 1,500,000 = 1500 pts', () => expect(calculateLoyaltyPoints(1500000)).toBe(1500));
});

describe('Commission Calculation', () => {
  it('10% of Rp 2,500,000 = Rp 250,000', () => {
    expect(calculateCommission(2500000)).toBe(250000);
  });

  it('10% of Rp 1,000,000 = Rp 100,000', () => {
    expect(calculateCommission(1000000)).toBe(100000);
  });

  it('10% of Rp 99,000 = Rp 9,900', () => {
    expect(calculateCommission(99000)).toBe(9900);
  });
});
