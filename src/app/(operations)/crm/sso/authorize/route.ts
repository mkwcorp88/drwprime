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
    const html = `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Masuk CRM DRW Prime</title><body style="box-sizing:border-box;margin:0;padding:24px;font-family:system-ui,sans-serif;background:radial-gradient(ellipse at 80% 0%,rgba(172,126,36,.18),transparent 38rem),#0a0a0a;color:#f7f4ed;display:grid;place-items:center;min-height:100vh"><main style="box-sizing:border-box;width:min(100%,440px);padding:32px;border:1px solid rgba(225,202,151,.22);border-radius:20px;background:rgba(35,33,29,.85);box-shadow:0 20px 60px rgba(0,0,0,.35);backdrop-filter:blur(18px)"><span style="color:#e5c77b;font-size:11px;font-weight:800;letter-spacing:.15em;text-transform:uppercase">DRW Prime · Akses staf</span><h1 style="font-family:Georgia,serif;font-size:29px;line-height:1.2;margin:14px 0">Lanjut ke CRM DRW Prime</h1><p style="color:#cfc6b5;line-height:1.65;margin:0 0 24px">Masuk dengan akun staf yang sudah diverifikasi.</p><form method="post" action="${target}"><input type="hidden" name="ticket" value="${ticket}"><button style="background:linear-gradient(135deg,#f2d982,#d2a637);color:#18140b;border:1px solid #e2c36e;border-radius:10px;padding:13px 20px;font-weight:700;cursor:pointer">Lanjut ke CRM →</button></form></main></body></html>`;
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
