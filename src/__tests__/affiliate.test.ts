import { describe, it, expect } from 'vitest';
import { validateAffiliateCode } from '@/lib/affiliate';
import { normalizePhone } from '@/lib/phone';
import { calculateCommission } from '@/lib/affiliate';

describe('Affiliate Code Validation', () => {
  it('accepts valid 5-char code', () => {
    expect(validateAffiliateCode('DRJJ9')).toEqual({ valid: true });
  });

  it('accepts valid 10-char code', () => {
    expect(validateAffiliateCode('ABCDE12345')).toEqual({ valid: true });
  });

  it('rejects code shorter than 5 chars', () => {
    const result = validateAffiliateCode('ABC');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('5-10');
  });

  it('rejects code longer than 10 chars', () => {
    const result = validateAffiliateCode('ABCDEFGHIJK');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('5-10');
  });

  it('rejects code with special characters', () => {
    const result = validateAffiliateCode('DR-JJ');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('huruf dan angka');
  });

  it('rejects forbidden words (case insensitive)', () => {
    const result = validateAffiliateCode('ADMIN1');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('tidak diperbolehkan');
  });

  it('rejects empty code', () => {
    const result = validateAffiliateCode('');
    expect(result.valid).toBe(false);
  });
});

describe('Phone Normalization', () => {
  it('normalizes 08 prefix to 62', () => {
    expect(normalizePhone('08123456789')).toBe('628123456789');
  });

  it('normalizes +62 prefix', () => {
    expect(normalizePhone('+6281234567890')).toBe('6281234567890');
  });

  it('keeps 62 prefix as-is', () => {
    expect(normalizePhone('6281234567890')).toBe('6281234567890');
  });

  it('strips non-digit characters', () => {
    expect(normalizePhone('0812-3456-789')).toBe('628123456789');
  });
});

describe('Commission Calculation', () => {
  it('default rate 10%', () => {
    expect(calculateCommission(1000000)).toBe(100000);
  });

  it('custom rate 5%', () => {
    expect(calculateCommission(1000000, 0.05)).toBe(50000);
  });

  it('rounds to 2 decimals', () => {
    expect(calculateCommission(12345, 0.1)).toBe(1234.5);
  });
});
