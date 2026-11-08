import { NextResponse } from 'next/server';
import { MemberAuthError } from '@/lib/member-auth/policy';
import { memberJson, memberRequestIp, memberResponse } from '@/lib/member-auth/http';
import { StaffAuthError } from './service';

export const staffJson = memberJson;
export const staffRequestIp = memberRequestIp;
export const staffResponse = memberResponse;

export function assertStaffOrigin(request: Request) {
  const url = new URL(request.url);
  const appOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL || request.url).origin;
  const allowed = [appOrigin];
  const [host, port] = (request.headers.get('host') || '').toLowerCase().split(':');
  if (host === 'crm.drwprime.com') allowed.push('https://crm.drwprime.com');
  if (process.env.NODE_ENV !== 'production' && ['crm.localhost','crm.prime.localhost'].includes(host) && (!port || /^\d{1,5}$/.test(port))) allowed.push(`http://${host}${port ? `:${port}` : ''}`);
  if (url.hostname === 'marketing.drwprime.com' || url.hostname === 'marketing.localhost'
    || url.hostname === 'crm.drwprime.com' || url.hostname === 'crm.localhost'
    || (process.env.NODE_ENV !== 'production' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1'))) {
    allowed.push(url.origin);
  }
  if (!allowed.includes(request.headers.get('origin') || '') || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new StaffAuthError(403, 'Permintaan harus berasal dari website DRW Prime.', 'ORIGIN_INVALID');
  }
}

export function staffError(error: unknown) {
  if (error instanceof StaffAuthError || error instanceof MemberAuthError) {
    const response = staffResponse({ error: error.message, code: error.code, retryAfterSeconds: error.retryAfterSeconds }, error.status);
    if (error.retryAfterSeconds) response.headers.set('Retry-After', String(error.retryAfterSeconds));
    return response;
  }
  console.error('[STAFF AUTH] Request failed');
  return NextResponse.json({ error: 'Permintaan belum dapat diproses. Silakan coba lagi.' }, { status: 500 });
}
