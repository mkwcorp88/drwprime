import { isIP } from 'node:net';
import { NextResponse } from 'next/server';
import { MemberAuthError } from './policy';

export function assertMemberOrigin(request: Request): void {
  const expected = new URL(process.env.NEXT_PUBLIC_APP_URL || request.url).origin;
  if (request.headers.get('origin') !== expected || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new MemberAuthError(403, 'Permintaan harus berasal dari website DRW Prime.', 'ORIGIN_INVALID');
  }
}

export function memberRequestIp(request: Request): string {
  // Enable only behind a proxy that OVERWRITES X-Real-IP. Missing/untrusted IPs
  // share a conservative bucket rather than trusting a user-supplied header.
  const value = process.env.MEMBER_TRUST_PROXY === 'true' ? request.headers.get('x-real-ip')?.trim() : null;
  return value && isIP(value) ? value : 'shared';
}

export async function memberJson(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') {
    throw new MemberAuthError(415, 'Format permintaan tidak valid.', 'BODY_INVALID');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new MemberAuthError(400, 'Data belum lengkap.', 'BODY_INVALID');
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 16_384) {
      await reader.cancel();
      throw new MemberAuthError(413, 'Data permintaan terlalu besar.', 'BODY_INVALID');
    }
    chunks.push(value);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch {
    throw new MemberAuthError(400, 'Data permintaan tidak valid.', 'BODY_INVALID');
  }
}

export function memberResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
}

export function memberError(error: unknown) {
  if (error instanceof MemberAuthError) {
    const response = memberResponse({ error: error.message, code: error.code, retryAfterSeconds: error.retryAfterSeconds }, error.status);
    if (error.retryAfterSeconds) response.headers.set('Retry-After', String(error.retryAfterSeconds));
    return response;
  }
  console.error('[MEMBER AUTH] Request failed');
  return memberResponse({ error: 'Permintaan belum dapat diproses. Silakan coba lagi.' }, 500);
}
