import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { hash, verify } from 'argon2';
import type { OpsRole, OpsStaff } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requiresOpsPasswordChange } from './auth-mode';
import { normalizeOpsEmail, validateOpsEmail, validateOpsPassword } from './password';
import { createQrToken, createStaffBadgeValue, extractStaffBadgeToken, hashQrToken, OpsError } from './utils';

const SESSION_COOKIE = 'drw_ops_session';
const SESSION_AGE_SECONDS = 60 * 60 * 12;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 15;

function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function issueOpsSession(staffId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_AGE_SECONDS * 1000);
  await prisma.opsSession.create({ data: { staffId, tokenHash: hashSessionToken(token), expiresAt } });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_AGE_SECONDS,
  });
}

export async function completeOpsLogin(staffId: string): Promise<OpsStaff> {
  const loggedInAt = new Date();
  const updatedStaff = await prisma.$transaction(async (tx) => {
    const activeStaff = await tx.opsStaff.findFirst({ where: { id: staffId, active: true }, select: { id: true } });
    if (!activeStaff) throw new OpsError(401, 'Akun operasional tidak aktif.', 'STAFF_INACTIVE');

    await tx.opsSession.deleteMany({ where: { staffId, expiresAt: { lt: loggedInAt } } });
    return tx.opsStaff.update({
      where: { id: staffId },
      data: { lastLoginAt: loggedInAt, failedLoginAttempts: 0, lockedUntil: null },
    });
  });
  await issueOpsSession(staffId);
  return updatedStaff;
}

function invalidCredentials(): never {
  throw new OpsError(401, 'Email atau password salah.', 'INVALID_CREDENTIALS');
}

export async function loginOpsStaff(email: string, password: string): Promise<OpsStaff> {
  const normalizedEmail = normalizeOpsEmail(email);
  if (validateOpsEmail(normalizedEmail)) invalidCredentials();

  const staff = await prisma.opsStaff.findUnique({ where: { email: normalizedEmail } });
  if (!staff || !staff.active) invalidCredentials();

  if (staff.lockedUntil && staff.lockedUntil > new Date()) {
    throw new OpsError(429, 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.', 'LOGIN_LOCKED');
  }

  let passwordMatches = false;
  try {
    passwordMatches = await verify(staff.passwordHash, password);
  } catch {
    passwordMatches = false;
  }

  if (!passwordMatches) {
    const failedLoginAttempts = staff.failedLoginAttempts + 1;
    await prisma.opsStaff.update({
      where: { id: staff.id },
      data: {
        failedLoginAttempts,
        lockedUntil: failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS
          ? new Date(Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000)
          : null,
      },
    });
    invalidCredentials();
  }

  return completeOpsLogin(staff.id);
}

export async function logoutOpsStaff(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  try {
    if (token) await prisma.opsSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  } finally {
    cookieStore.delete(SESSION_COOKIE);
  }
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
  if (!staff) throw new OpsError(401, 'Silakan masuk dengan akun operasional.', 'AUTH_REQUIRED');
  if (requiresOpsPasswordChange(staff)) {
    throw new OpsError(403, 'Ganti password awal sebelum menggunakan sistem.', 'PASSWORD_CHANGE_REQUIRED');
  }
  if (allowedRoles && !allowedRoles.includes(staff.role)) {
    throw new OpsError(403, 'Anda tidak memiliki akses untuk tindakan ini.', 'FORBIDDEN');
  }
  return staff;
}

export async function changeOpsStaffPassword(staff: OpsStaff, currentPassword: string, newPassword: string): Promise<void> {
  let currentMatches = false;
  try {
    currentMatches = await verify(staff.passwordHash, currentPassword);
  } catch {
    currentMatches = false;
  }
  if (!currentMatches) throw new OpsError(400, 'Password saat ini salah.', 'CURRENT_PASSWORD_INVALID');

  const passwordError = validateOpsPassword(newPassword);
  if (passwordError) throw new OpsError(422, passwordError, 'PASSWORD_INVALID');
  if (currentPassword === newPassword) {
    throw new OpsError(422, 'Password baru harus berbeda dari password saat ini.', 'PASSWORD_REUSED');
  }

  const passwordHash = await hash(newPassword);
  const changedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.opsStaff.update({
      where: { id: staff.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt: changedAt,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await tx.opsSession.deleteMany({ where: { staffId: staff.id } });
    await tx.opsAuditLog.create({
      data: {
        actorUserId: staff.id,
        branchId: staff.branchId,
        entityType: 'STAFF_ACCOUNT',
        entityId: staff.id,
        action: 'CHANGE_PASSWORD',
        afterData: { passwordChangedAt: changedAt.toISOString() },
      },
    });
  });
  await issueOpsSession(staff.id);
}

export async function resolveStaffBadge(value: string, allowedRoles?: readonly OpsRole[]): Promise<OpsStaff> {
  const token = extractStaffBadgeToken(value);
  const staff = await prisma.opsStaff.findUnique({ where: { badgeTokenHash: hashQrToken(token) } });
  if (!staff || !staff.active) throw new OpsError(403, 'Kartu staf tidak valid atau sudah tidak aktif.');
  if (requiresOpsPasswordChange(staff)) throw new OpsError(403, 'Pemilik kartu wajib mengganti password awal terlebih dahulu.');
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
      data: { badgeToken: token, badgeTokenHash: hashQrToken(token), badgeIssuedAt: issuedAt },
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
