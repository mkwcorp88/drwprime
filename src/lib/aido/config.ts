import { isValidSyncDate } from '@/lib/aido/mapping';
import { AidoConfigurationError } from '@/lib/aido/client';

function getCurrentJakartaDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function getAidoCutoverDate(): string | null {
  const value = process.env.AIDO_SYNC_CUTOVER_DATE?.trim();
  return value && isValidSyncDate(value) ? value : null;
}

export function getAidoCutoverStart(): Date | null {
  const date = getAidoCutoverDate();
  return date ? new Date(`${date}T00:00:00+07:00`) : null;
}

export function isAidoManagedSpendingDate(date = new Date()): boolean {
  const canonicalEnabled = process.env.AIDO_SYNC_CANONICAL_SPENDING === 'true';
  const configuredCutover = process.env.AIDO_SYNC_CUTOVER_DATE?.trim();
  if (canonicalEnabled && (!configuredCutover || !getAidoCutoverDate())) return true;
  const cutoverStart = getAidoCutoverStart();
  return cutoverStart !== null && date >= cutoverStart;
}

export function isAidoCanonicalSpendingActive(date = getCurrentJakartaDate()): boolean {
  const cutoverDate = getAidoCutoverDate();
  return process.env.AIDO_SYNC_CANONICAL_SPENDING === 'true'
    && cutoverDate !== null
    && date >= cutoverDate;
}

export function assertAidoCanonicalSpending(date: string): void {
  if (!isAidoCanonicalSpendingActive(date)) {
    throw new AidoConfigurationError(
      'AIDO canonical spending and a valid cutover date must be configured'
    );
  }
}
