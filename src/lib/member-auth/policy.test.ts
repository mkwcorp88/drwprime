import { describe, expect, it } from 'vitest';
import { normalizeLoginPhone, memberRedirect, parseBirthDate } from './policy';
import { assertMemberOrigin, memberJson } from './http';

describe('member login input boundaries', () => {
  it.each(['0815-4288-8666', '+62 815-4288-8666', '6281542888666', '81542888666'])('normalizes %s', (phone) => {
    expect(normalizeLoginPhone(phone)).toBe('6281542888666');
  });
  it.each(['', '62812abc34567890', '1234567890', '+1 212 555 0123', '0812/34567890', {}, null])('rejects invalid identity input %s', (phone) => {
    expect(() => normalizeLoginPhone(phone)).toThrow();
  });
  it.each(['https://evil.example', '//evil.example', '/\\evil.example', '/my-prime/../../staff/sign-in', '/api/member-auth/logout', '/cms', '/admin'])('rejects unsafe redirect %s', (url) => {
    expect(memberRedirect(url)).toBe('/my-prime');
  });
  it('retains member booking and referral destinations', () => {
    expect(memberRedirect('/reservation?ref=ABCDE')).toBe('/reservation?ref=ABCDE');
    expect(memberRedirect('/my-prime/profile')).toBe('/my-prime/profile');
  });
  it('rejects overflowing calendar dates', () => {
    expect(parseBirthDate('2000-02-30')).toBeNull();
    expect(parseBirthDate('2000-02-29')?.toISOString()).toBe('2000-02-29T00:00:00.000Z');
  });
  it('rejects cross-origin and missing-origin cookie mutations', () => {
    expect(() => assertMemberOrigin(new Request('https://drwprime.com/api/member-auth/request'))).toThrow();
    expect(() => assertMemberOrigin(new Request('https://drwprime.com/api/member-auth/request', { headers: { origin: 'https://evil.example' } }))).toThrow();
  });
  it('rejects oversized streamed JSON, including absent Content-Length', async () => {
    await expect(memberJson(new Request('https://drwprime.com/api/member-auth/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '8'.repeat(20_000) }) }))).rejects.toMatchObject({ status: 413 });
  });
});
