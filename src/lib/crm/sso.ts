import { newToken, tokenHash } from '@/lib/member-auth/session';
import { STAFF_SESSION_SECONDS } from '@/lib/staff-auth/service';
import { prisma } from '@/lib/prisma';
import { CrmError } from './auth';

export const CRM_SSO_COOKIE = 'drw_crm_sso_binding';
export function ssoOrigins(port = '') {
  if (process.env.NODE_ENV === 'production') return { main: 'https://drwprime.com', crm: 'https://crm.drwprime.com' };
  const suffix = port ? `:${port}` : '';
  const domain = process.env.CRM_SSO_DEV_DOMAIN === 'prime.localhost' ? 'prime.localhost' : 'localhost';
  return { main: `http://${domain}${suffix}`, crm: `http://crm.${domain}${suffix}` };
}
export function isCrmHost(host: string) { return host === 'crm.drwprime.com' || (process.env.NODE_ENV !== 'production' && ['crm.localhost','crm.prime.localhost'].includes(host)); }
export function isMainHost(host: string) { return host === 'drwprime.com' || (process.env.NODE_ENV !== 'production' && ['localhost','prime.localhost'].includes(host)); }
export function requestHost(request: Request) {
  const match = /^([a-z0-9.-]+)(?::(\d{1,5}))?$/i.exec(request.headers.get('host') || '');
  return { host: (match?.[1] || '').toLowerCase(), port: match?.[2] || '' };
}
export const ssoHeaders = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY' };

export async function issueSsoTicket(staffId: string, challengeHash: string) {
  if (!/^[a-f0-9]{64}$/.test(challengeHash)) throw new CrmError('Permintaan login tidak valid.', 400);
  const token = newToken();
  await prisma.crmSsoTicket.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.crmSsoTicket.create({ data: { tokenHash: tokenHash(token), challengeHash, staffId, expiresAt: new Date(Date.now() + 120_000) } });
  return token;
}

export async function consumeSsoTicket(token: string, binding: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !/^[A-Za-z0-9_-]{43}$/.test(binding)) throw new CrmError('Sesi login telah berakhir. Silakan masuk kembali.', 403);
  const hash = tokenHash(token), challengeHash = tokenHash(binding), sessionToken = newToken();
  await prisma.$transaction(async (tx) => {
    const ticket = await tx.crmSsoTicket.findUnique({ where: { tokenHash: hash }, include: { staff: { include: { crmGrant: true } } } });
    if (!ticket || ticket.expiresAt <= new Date() || ticket.challengeHash !== challengeHash || !ticket.staff.active || !ticket.staff.crmGrant?.active) throw new CrmError('Sesi login telah berakhir. Silakan masuk kembali.', 403);
    const used = await tx.crmSsoTicket.deleteMany({ where: { tokenHash: hash, challengeHash, expiresAt: { gt: new Date() } } });
    if (used.count !== 1) throw new CrmError('Sesi login sudah digunakan.', 403);
    await tx.staffSession.create({ data: { staffId: ticket.staffId, tokenHash: tokenHash(sessionToken), expiresAt: new Date(Date.now() + STAFF_SESSION_SECONDS * 1000) } });
  });
  return sessionToken;
}
