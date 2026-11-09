export const IPL_PACKAGE_PRICE = 1_111_000;

// 11 November 2026, 00.00–23.59 WIB. The end is exclusive.
export const CAMPAIGN_START = new Date('2026-11-10T17:00:00.000Z');
export const CAMPAIGN_END = new Date('2026-11-11T17:00:00.000Z');

export function campaignPhase(now = new Date()): 'upcoming' | 'open' | 'closed' {
  if (now < CAMPAIGN_START) return 'upcoming';
  if (now >= CAMPAIGN_END) return 'closed';
  return 'open';
}

/** One calendar year later in WIB, clamping 29 February to 28 February. */
export function packageExpiry(paidAt: Date): Date {
  const offset = 7 * 60 * 60 * 1000;
  const local = new Date(paidAt.getTime() + offset);
  const day = local.getUTCDate();
  local.setUTCDate(1);
  local.setUTCFullYear(local.getUTCFullYear() + 1);
  const lastDay = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
  local.setUTCDate(Math.min(day, lastDay));
  return new Date(local.getTime() - offset);
}

export function displayPackageStatus(status: string, expiresAt: Date | null, now = new Date()) {
  if (status === 'active' && expiresAt && expiresAt <= now) return 'expired';
  return status;
}
