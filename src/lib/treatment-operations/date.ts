const JAKARTA_TIME_ZONE = 'Asia/Jakarta';

function dateParts(value: Date): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: JAKARTA_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value).map(({ type, value: partValue }) => [type, partValue]),
  );
}

export function dateKeyFromDate(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const parts = dateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function dateKeyToDate(value: string): Date {
  // PostgreSQL DATE is represented by Prisma as UTC midnight.
  return new Date(`${value}T00:00:00.000Z`);
}

export function addDateKeys(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function formatDateKey(value: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: JAKARTA_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dateKeyToDate(value));
}
