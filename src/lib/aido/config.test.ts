import { afterEach, describe, expect, it } from 'vitest';
import {
  getAidoCutoverDate,
  getAidoCutoverStart,
  isAidoManagedSpendingDate,
  isAidoCanonicalSpendingActive,
} from '@/lib/aido/config';

const originalCanonical = process.env.AIDO_SYNC_CANONICAL_SPENDING;
const originalCutover = process.env.AIDO_SYNC_CUTOVER_DATE;

afterEach(() => {
  if (originalCanonical === undefined) delete process.env.AIDO_SYNC_CANONICAL_SPENDING;
  else process.env.AIDO_SYNC_CANONICAL_SPENDING = originalCanonical;
  if (originalCutover === undefined) delete process.env.AIDO_SYNC_CUTOVER_DATE;
  else process.env.AIDO_SYNC_CUTOVER_DATE = originalCutover;
});

describe('AIDO spending cutover', () => {
  it('stays disabled without an explicit valid cutover', () => {
    process.env.AIDO_SYNC_CANONICAL_SPENDING = 'true';
    process.env.AIDO_SYNC_CUTOVER_DATE = 'invalid';
    expect(getAidoCutoverDate()).toBeNull();
    expect(isAidoCanonicalSpendingActive('2026-08-21')).toBe(false);
  });

  it('activates on the configured Jakarta cutover date', () => {
    process.env.AIDO_SYNC_CANONICAL_SPENDING = 'true';
    process.env.AIDO_SYNC_CUTOVER_DATE = '2026-08-21';
    expect(isAidoCanonicalSpendingActive('2026-08-20')).toBe(false);
    expect(isAidoCanonicalSpendingActive('2026-08-21')).toBe(true);
    expect(getAidoCutoverStart()?.toISOString()).toBe('2026-08-20T17:00:00.000Z');
    expect(isAidoManagedSpendingDate(new Date('2026-08-20T16:59:59.999Z'))).toBe(false);
    expect(isAidoManagedSpendingDate(new Date('2026-08-20T17:00:00.000Z'))).toBe(true);
  });

  it('keeps the manual-write boundary when canonical sync is paused', () => {
    process.env.AIDO_SYNC_CANONICAL_SPENDING = 'false';
    process.env.AIDO_SYNC_CUTOVER_DATE = '2026-08-21';
    expect(isAidoCanonicalSpendingActive('2026-08-21')).toBe(false);
    expect(isAidoManagedSpendingDate(new Date('2026-08-20T17:00:00.000Z'))).toBe(true);
  });

  it('fails closed for a malformed cutover while canonical mode is enabled', () => {
    process.env.AIDO_SYNC_CANONICAL_SPENDING = 'true';
    process.env.AIDO_SYNC_CUTOVER_DATE = 'not-a-date';
    expect(isAidoManagedSpendingDate(new Date('2026-08-20T00:00:00.000Z'))).toBe(true);
  });
});
