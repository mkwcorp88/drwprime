import { describe, expect, it } from 'vitest';
import { createQrToken, getPeriodRange, hashQrToken, jakartaDateKey, jakartaPeriod, maskPatientName } from '@/lib/treatment-operations/utils';

describe('treatment operations utilities', () => {
  it('creates opaque QR tokens and stores deterministic hashes', () => {
    const token = createQrToken();
    expect(token.length).toBeGreaterThan(30);
    expect(hashQrToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashQrToken(token)).toBe(hashQrToken(token));
  });

  it('masks every patient name segment', () => {
    expect(maskPatientName('Ayu Lestari')).toBe('A** L******');
  });

  it('uses a stable YYYY-MM incentive period in Jakarta time', () => {
    expect(jakartaPeriod(new Date('2026-08-31T18:00:00.000Z'))).toBe('2026-09');
  });

  it('labels dates in Jakarta time even near midnight UTC', () => {
    expect(jakartaDateKey(new Date('2026-08-31T18:00:00.000Z'))).toBe('2026-09-01');
  });

  it('computes an inclusive/exclusive month range in Jakarta time', () => {
    const { start, end } = getPeriodRange('custom', '2026-08-01', '2026-08-31');
    // Jakarta midnight on 2026-08-01 = 2026-07-31T17:00:00Z
    expect(start.toISOString()).toBe('2026-07-31T17:00:00.000Z');
    // Exclusive end = Jakarta midnight on 2026-09-01
    expect(end.toISOString()).toBe('2026-08-31T17:00:00.000Z');
  });

  it('computes a Monday-based week range', () => {
    const { start, end } = getPeriodRange('custom', '2026-08-26', '2026-08-26');
    expect(start.getTime() < end.getTime()).toBe(true);
    expect(end.getTime() - start.getTime()).toBe(86400000);
  });
});
