import { NextRequest, NextResponse } from 'next/server';
import { setStaffSessionCookie } from '@/lib/staff-auth/service';
import { crmError, CrmError } from '@/lib/crm/auth';
import { consumeSsoTicket, CRM_SSO_COOKIE, isCrmHost, requestHost, ssoHeaders, ssoOrigins } from '@/lib/crm/sso';

export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    const { host, port } = requestHost(request);
    if (!isCrmHost(host) || request.headers.get('origin') !== ssoOrigins(port).main) throw new CrmError('Permintaan login tidak valid.', 403);
    const length = Number(request.headers.get('content-length'));
    if (!length || length > 4096) throw new CrmError('Permintaan login tidak valid.', 400);
    const form = await request.formData();
    const rawTicket = form.get('ticket');
    if (typeof rawTicket !== 'string') throw new CrmError('Sesi login telah berakhir.', 403);
    const session = await consumeSsoTicket(rawTicket, request.cookies.get(CRM_SSO_COOKIE)?.value || '');
    const response = NextResponse.redirect(new URL('/crm', ssoOrigins(port).crm), { status: 303, headers: ssoHeaders });
    setStaffSessionCookie(response, session);
    response.cookies.set(CRM_SSO_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
  } catch (error) { return crmError(error); }
}
