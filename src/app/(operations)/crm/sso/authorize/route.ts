import { NextRequest, NextResponse } from 'next/server';
import { crmAccess, crmError, CrmError } from '@/lib/crm/auth';
import { isMainHost, issueSsoTicket, requestHost, ssoHeaders, ssoOrigins } from '@/lib/crm/sso';
import { StaffAuthError } from '@/lib/staff-auth/service';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const { host, port } = requestHost(request);
  if (!isMainHost(host)) return new NextResponse('Not found', { status: 404 });
  const challenge = request.nextUrl.searchParams.get('challenge') || '';
  if (!/^[a-f0-9]{64}$/.test(challenge)) return new NextResponse('Permintaan login tidak valid.', { status: 400, headers: ssoHeaders });
  try {
    const { staff } = await crmAccess();
    const ticket = await issueSsoTicket(staff.id, challenge);
    const target = `${ssoOrigins(port).crm}/api/crm/sso/consume`;
    const html = `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Masuk CRM DRW Prime</title><body style="font-family:system-ui;background:#f7f8f7;color:#1c252e;display:grid;place-items:center;min-height:95vh"><main style="background:white;padding:32px;border-radius:18px;max-width:420px"><h1>Lanjut ke CRM DRW Prime</h1><p>Masuk dengan akun staf yang sudah diverifikasi.</p><form method="post" action="${target}"><input type="hidden" name="ticket" value="${ticket}"><button style="background:#ad812d;color:white;border:0;border-radius:10px;padding:14px 22px;font-weight:700">Lanjut ke CRM →</button></form></main></body></html>`;
    // Send only the origin (never the challenge URL) so the receiving POST can
    // validate Origin; no-referrer makes browsers send the literal "null".
    return new NextResponse(html, { headers: { ...ssoHeaders, 'Referrer-Policy': 'strict-origin', 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; form-action ${ssoOrigins(port).crm}` } });
  } catch (error) {
    if (error instanceof StaffAuthError) {
      const login = new URL('/staff/sign-in', ssoOrigins(port).main);
      login.searchParams.set('redirect_url', `/crm/sso/authorize?challenge=${challenge}`);
      return NextResponse.redirect(login, { headers: ssoHeaders });
    }
    if (error instanceof CrmError) return new NextResponse('Akun staf ini belum memiliki akses CRM. Hubungi admin CRM.', { status: error.status, headers: ssoHeaders });
    return crmError(error);
  }
}
