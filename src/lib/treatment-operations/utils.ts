import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';

export class OpsError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'OpsError';
  }
}

export function hashQrToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createQrToken(): string {
  return randomBytes(32).toString('base64url');
}

const STAFF_BADGE_PREFIX = 'DRW-STAFF:';

export function createStaffBadgeValue(token: string): string {
  return `${STAFF_BADGE_PREFIX}${token}`;
}

export function extractStaffBadgeToken(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new OpsError(400, 'QR kartu staf kosong.');
  if (normalized.toUpperCase().startsWith(STAFF_BADGE_PREFIX)) {
    return normalized.slice(STAFF_BADGE_PREFIX.length).trim();
  }
  return normalized;
}

export function maskPatientName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => `${part.charAt(0)}${'*'.repeat(Math.max(2, part.length - 1))}`)
    .join(' ');
}

export function rupiah(value: Prisma.Decimal | number | string): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function jakartaPeriod(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return `${year}-${month}`;
}

export function serialize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => (item instanceof Prisma.Decimal ? Number(item) : item)),
  ) as T;
}

export type PeriodKey = 'today' | 'week' | 'month' | 'year' | 'custom';

const JAKARTA_OFFSET_MS = 7 * 3600 * 1000;
const DAY_MS = 86400000;

export function jakartaDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function jakartaMidnightUtc(date: Date): Date {
  const [year, month, day] = jakartaDateKey(date).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day) - JAKARTA_OFFSET_MS);
}

function parseDateOnlyToJakartaMidnight(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day) - JAKARTA_OFFSET_MS);
}

function jakartaWeekday(date: Date): number {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', weekday: 'short' }).format(date);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
}

export function getPeriodRange(period: PeriodKey, customStart?: string, customEnd?: string): { start: Date; end: Date } {
  const now = new Date();

  if (period === 'custom') {
    const start = customStart ? parseDateOnlyToJakartaMidnight(customStart) : jakartaMidnightUtc(now);
    const end = customEnd ? parseDateOnlyToJakartaMidnight(customEnd) : start;
    return { start, end: new Date(end.getTime() + DAY_MS) };
  }

  const today = jakartaMidnightUtc(now);

  if (period === 'today') return { start: today, end: new Date(today.getTime() + DAY_MS) };

  if (period === 'week') {
    const daysSinceMonday = (jakartaWeekday(now) + 6) % 7;
    const start = new Date(today.getTime() - daysSinceMonday * DAY_MS);
    return { start, end: new Date(start.getTime() + 7 * DAY_MS) };
  }

  if (period === 'month') {
    const [year, month] = jakartaDateKey(now).split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1) - JAKARTA_OFFSET_MS);
    const end = new Date(Date.UTC(year, month, 1) - JAKARTA_OFFSET_MS);
    return { start, end };
  }

  const year = Number(jakartaDateKey(now).slice(0, 4));
  const start = new Date(Date.UTC(year, 0, 1) - JAKARTA_OFFSET_MS);
  const end = new Date(Date.UTC(year + 1, 0, 1) - JAKARTA_OFFSET_MS);
  return { start, end };
}
