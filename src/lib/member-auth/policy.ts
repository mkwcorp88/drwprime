export const OTP_TTL_SECONDS = 300;
export const OTP_RESEND_SECONDS = 60;
export const OTP_MAX_ATTEMPTS = 5;
export const ENROLLMENT_TTL_SECONDS = 600;
export const MEMBER_SESSION_SECONDS = 60 * 60 * 24 * 30;
export const MEMBER_SESSION_COOKIE = 'drw_member_session';
export const OTP_BINDING_COOKIE = 'drw_member_otp_browser';
export const ENROLLMENT_COOKIE = 'drw_member_enrollment';

export class MemberAuthError extends Error {
  constructor(public status: number, message: string, public code: string, public retryAfterSeconds?: number) {
    super(message);
    this.name = 'MemberAuthError';
  }
}

export function normalizeLoginPhone(input: unknown): string {
  if (typeof input !== 'string' || input.length > 40 || !/^\+?[\d\s().-]+$/.test(input.trim())) {
    throw new MemberAuthError(400, 'Masukkan nomor WhatsApp Indonesia yang valid.', 'PHONE_INVALID');
  }
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith('8')) digits = `62${digits}`;
  if (!/^628\d{8,11}$/.test(digits)) {
    throw new MemberAuthError(400, 'Masukkan nomor WhatsApp Indonesia yang valid.', 'PHONE_INVALID');
  }
  return digits;
}

export function parseBirthDate(input: unknown): Date | null {
  if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const date = new Date(`${input}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input || date > new Date()) return null;
  return date;
}

// Only member destinations may be restored after OTP login.
export function memberRedirect(input: string | null | undefined): string {
  if (!input || !input.startsWith('/') || input.startsWith('//') || /[\\\r\n]/.test(input)) return '/my-prime';
  try {
    const url = new URL(input, 'https://member.invalid');
    const allowed = ['/my-prime', '/affiliate-dashboard', '/reservation', '/treatments', '/product-gallery', '/products'];
    if (url.origin !== 'https://member.invalid' || !allowed.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`))) return '/my-prime';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/my-prime';
  }
}
