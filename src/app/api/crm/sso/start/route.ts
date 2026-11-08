import { NextRequest, NextResponse } from 'next/server';
import { newToken, tokenHash } from '@/lib/member-auth/session';
import { CRM_SSO_COOKIE, isCrmHost, requestHost, ssoHeaders, ssoOrigins } from '@/lib/crm/sso';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const { host, port } = requestHost(request);
  if (!isCrmHost(host)) return new NextResponse('Not found', { status: 404 });
  const binding = newToken();
  const target = new URL('/crm/sso/authorize', ssoOrigins(port).main);
  target.searchParams.set('challenge', tokenHash(binding));
  const response = NextResponse.redirect(target, { headers: ssoHeaders });
  response.cookies.set(CRM_SSO_COOKIE, binding, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 300 });
  return response;
}
