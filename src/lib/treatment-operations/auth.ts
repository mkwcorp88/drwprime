import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { verify } from 'argon2';
import type { OpsRole, OpsStaff } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createQrToken, createStaffBadgeValue, extractStaffBadgeToken, hashQrToken, OpsError } from './utils';

const SESSION_COOKIE = 'drw_ops_session';
const SESSION_AGE_SECONDS = 60 * 60 * 12;

function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function loginOpsStaff(username: string, password: string): Promise<OpsStaff> {
  const normalizedUsername = username.trim().toLowerCase();
  const staff = await prisma.opsStaff.findUnique({ where: { username: normalizedUsername } });
  if (!staff || !staff.active || !(await verify(staff.passwordHash, password))) {
    throw new OpsError(403, 'Username atau password salah.');
  }

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_AGE_SECONDS * 1000);
  await prisma.$transaction([
    prisma.opsSession.deleteMany({ where: { staffId: staff.id, expiresAt: { lt: new Date() } } }),
    prisma.opsSession.create({ data: { staffId: staff.id, tokenHash: hashSessionToken(token), expiresAt } }),
    prisma.opsStaff.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } }),
  ]);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_AGE_SECONDS,
  });
  return staff;
}

export async function logoutOpsStaff(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await prisma.opsSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  cookieStore.delete(SESSION_COOKIE);
}

export async function getOpsStaff(): Promise<OpsStaff | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.opsSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { staff: true },
  });
  if (!session || session.expiresAt <= new Date() || !session.staff.active) return null;
  return session.staff;
}

export async function requireOpsStaff(allowedRoles?: readonly OpsRole[]): Promise<OpsStaff> {
  const staff = await getOpsStaff();
  if (!staff) throw new OpsError(403, 'Silakan masuk dengan akun operasional.');
  if (allowedRoles && !allowedRoles.includes(staff.role)) {
    throw new OpsError(403, 'Anda tidak memiliki akses untuk tindakan ini.');
  }
  return staff;
}

export async function resolveStaffBadge(value: string, allowedRoles?: readonly OpsRole[]): Promise<OpsStaff> {
  const token = extractStaffBadgeToken(value);
  const staff = await prisma.opsStaff.findUnique({ where: { badgeTokenHash: hashQrToken(token) } });
  if (!staff || !staff.active) throw new OpsError(403, 'Kartu staf tidak valid atau sudah tidak aktif.');
  if (allowedRoles && !allowedRoles.includes(staff.role)) {
    throw new OpsError(403, 'Role pada kartu staf tidak dapat melakukan tindakan ini.');
  }
  return staff;
}

export async function issueStaffBadge(actor: OpsStaff, staffId: string) {
  const token = createQrToken();
  const issuedAt = new Date();
  const staff = await prisma.$transaction(async (tx) => {
    const current = await tx.opsStaff.findUnique({ where: { id: staffId } });
    if (!current || !current.active) throw new OpsError(404, 'Staf aktif tidak ditemukan.');
    const updated = await tx.opsStaff.update({
      where: { id: staffId },
      data: { badgeTokenHash: hashQrToken(token), badgeIssuedAt: issuedAt },
    });
    await tx.opsAuditLog.create({
      data: {
        actorUserId: actor.id,
        branchId: updated.branchId,
        entityType: 'STAFF_BADGE',
        entityId: updated.id,
        action: 'ISSUE',
        afterData: { staffId: updated.id, employeeId: updated.employeeId, issuedAt: issuedAt.toISOString() },
      },
    });
    return updated;
  });
  return {
    staff: { id: staff.id, employeeId: staff.employeeId, name: staff.name, role: staff.role },
    badgeValue: createStaffBadgeValue(token),
  };
}
