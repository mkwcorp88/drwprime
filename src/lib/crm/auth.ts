import { prisma } from '@/lib/prisma';
import { requireStaff, StaffAuthError } from '@/lib/staff-auth/service';
import { assertStaffOrigin } from '@/lib/staff-auth/http';
import { CRM_INITIAL_ADMINS, CRM_ROLES, type CrmRole } from './constants';

export class CrmError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

export async function crmAccess() {
  const staff = await requireStaff();
  let grant = await prisma.crmGrant.findUnique({ where: { staffId: staff.id } });
  // Recovery for the two requested owners when their verified Google identity
  // is registered after the migration. A disabled grant is never reactivated.
  if (!grant && staff.googleSub && CRM_INITIAL_ADMINS.includes((staff.email || '').toLowerCase() as typeof CRM_INITIAL_ADMINS[number])) {
    grant = await prisma.crmGrant.upsert({ where: { staffId: staff.id }, create: { staffId: staff.id, role: 'ADMIN' }, update: {} });
  }
  if (!grant?.active || !(grant.role in CRM_ROLES)) throw new CrmError('Akun staf ini belum memiliki akses CRM. Hubungi admin CRM.', 403);
  return { staff, role: grant.role as CrmRole };
}

export async function requireCrm(roles?: readonly CrmRole[]) {
  const access = await crmAccess();
  if (roles && !roles.includes(access.role)) throw new CrmError('Anda tidak memiliki akses untuk tindakan ini.', 403);
  return access;
}

export function assertCrmOrigin(request: Request) {
  assertStaffOrigin(request);
  const host = (request.headers.get('host') || '').toLowerCase();
  const hostname = host.split(':')[0];
  const allowed = ['drwprime.com','crm.drwprime.com'];
  if (process.env.NODE_ENV !== 'production') allowed.push('localhost','crm.localhost','prime.localhost','crm.prime.localhost','127.0.0.1');
  try {
    const origin = new URL(request.headers.get('origin') || '');
    if (!allowed.includes(hostname) || origin.host.toLowerCase() !== host || (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:')) throw new Error();
  } catch { throw new CrmError('Permintaan harus berasal dari halaman CRM.', 403); }
}

export function crmError(error: unknown) {
  if (error instanceof CrmError || error instanceof StaffAuthError) return Response.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } });
  console.error('[CRM] Request failed', error instanceof Error ? error.name : 'unknown');
  return Response.json({ error: 'Permintaan belum berhasil. Silakan coba lagi.' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } });
}
