import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { Prisma, type StaffAccount } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyGoogleCredential, type GoogleIdentity } from '@/lib/member-auth/google';
import { normalizeLoginPhone } from '@/lib/member-auth/policy';
import { newToken, tokenHash, validToken } from '@/lib/member-auth/session';
import { requireMemberOtpConfig, sendMemberOtp } from '@/lib/member-auth/whatsapp';
import { recordOtpSubmission } from '@/lib/whatsapp-otp-delivery';

export const STAFF_SESSION_COOKIE = 'drw_staff_session';
export const STAFF_OTP_BINDING_COOKIE = 'drw_staff_otp_browser';
export const STAFF_SESSION_SECONDS = 60 * 60 * 24 * 30;
const OTP_TTL_SECONDS = 300;
const OTP_RESEND_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export class StaffAuthError extends Error {
  constructor(public status: number, message: string, public code: string, public retryAfterSeconds?: number) {
    super(message);
    this.name = 'StaffAuthError';
  }
}

const invalidCode = () => new StaffAuthError(401, 'Kode tidak valid atau sudah kedaluwarsa. Silakan minta kode baru.', 'OTP_INVALID');
const staffCookieOptions = (maxAge: number) => ({
  httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge,
});

function staffHmac(text: string): string {
  const secret = process.env.MEMBER_OTP_SECRET?.trim();
  if (!secret || secret.length < 32) throw new StaffAuthError(503, 'Layanan OTP belum dikonfigurasi.', 'OTP_NOT_CONFIGURED');
  return createHmac('sha256', secret).update(`staff:${text}`).digest('hex');
}

function hashCode(challengeId: string, code: string): string {
  return staffHmac(`code:${challengeId}:${code}`);
}

async function lock(tx: Prisma.TransactionClient, ...keys: string[]) {
  for (const key of [...new Set(keys)].sort()) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`staff-auth:${key}`}, 0))::text`;
  }
}

async function issueSessionTx(tx: Prisma.TransactionClient, staffId: string) {
  const token = newToken();
  await tx.staffSession.deleteMany({ where: { staffId, expiresAt: { lte: new Date() } } });
  await tx.staffSession.create({ data: {
    staffId, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + STAFF_SESSION_SECONDS * 1000),
  } });
  await tx.staffAccount.update({ where: { id: staffId }, data: { updatedAt: new Date() } });
  return token;
}

export async function resolveStaffToken(token: string | undefined): Promise<StaffAccount | null> {
  if (!validToken(token)) return null;
  const session = await prisma.staffSession.findUnique({ where: { tokenHash: tokenHash(token) }, include: { staff: true } });
  if (!session || session.expiresAt <= new Date() || !session.staff.active) return null;
  return session.staff;
}

export const getStaff = cache(async () => resolveStaffToken((await cookies()).get(STAFF_SESSION_COOKIE)?.value));

export async function requireStaff(): Promise<StaffAccount> {
  const staff = await getStaff();
  if (!staff) throw new StaffAuthError(401, 'Silakan masuk sebagai staf.', 'STAFF_AUTH_REQUIRED');
  return staff;
}

export async function logoutStaff(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(STAFF_SESSION_COOKIE)?.value;
  if (validToken(token)) await prisma.staffSession.deleteMany({ where: { tokenHash: tokenHash(token) } });
  jar.set(STAFF_SESSION_COOKIE, '', staffCookieOptions(0));
  jar.set(STAFF_OTP_BINDING_COOKIE, '', staffCookieOptions(0));
}

export function setStaffSessionCookie(response: import('next/server').NextResponse, token: string) {
  response.cookies.set(STAFF_SESSION_COOKIE, token, staffCookieOptions(STAFF_SESSION_SECONDS));
}

export function setStaffBindingCookie(response: import('next/server').NextResponse, binding: string) {
  response.cookies.set(STAFF_OTP_BINDING_COOKIE, binding, staffCookieOptions(1800));
}

export async function requestStaffOtp(input: unknown, binding: string, ip: string, enrollingStaffId?: string) {
  requireMemberOtpConfig();
  const phone = normalizeLoginPhone(input);
  if (!validToken(binding)) throw invalidCode();
  const staff = enrollingStaffId
    ? await prisma.staffAccount.findUnique({ where: { id: enrollingStaffId } })
    : await prisma.staffAccount.findUnique({ where: { phone } });
  if (!staff?.active) throw new StaffAuthError(401, 'Nomor staf belum terdaftar. Hubungi administrator.', 'STAFF_NOT_REGISTERED');
  if (enrollingStaffId) {
    if (staff.phone) throw new StaffAuthError(409, 'Nomor staf sudah terverifikasi. Hubungi administrator untuk menggantinya.', 'PHONE_ALREADY_VERIFIED');
    if (await prisma.staffAccount.findUnique({ where: { phone } })) throw new StaffAuthError(409, 'Nomor sudah terdaftar pada akun staf lain.', 'PHONE_CONFLICT');
  }
  const phoneHash = staffHmac(`phone:${phone}`);
  const requestIpHash = staffHmac(`ip:${ip}`);
  const now = new Date();
  const since = new Date(now.getTime() - WINDOW_MS);
  const challengeId = newToken();
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  await prisma.$transaction(async (tx) => {
    await lock(tx, `phone:${phoneHash}`, `ip:${requestIpHash}`);
    const [latest, phoneCount, ipCount] = await Promise.all([
      tx.staffLoginOtp.findFirst({ where: { phoneHash }, orderBy: { createdAt: 'desc' } }),
      tx.staffLoginOtp.count({ where: { phoneHash, createdAt: { gte: since } } }),
      tx.staffLoginOtp.count({ where: { requestIpHash, createdAt: { gte: since } } }),
    ]);
    if (phoneCount >= 5 || ipCount >= 20) throw new StaffAuthError(429, 'Terlalu banyak permintaan. Coba lagi dalam 15 menit.', 'OTP_RATE_LIMITED', 900);
    const wait = latest ? Math.ceil((latest.createdAt.getTime() + OTP_RESEND_SECONDS * 1000 - now.getTime()) / 1000) : 0;
    if (wait > 0) throw new StaffAuthError(429, `Tunggu ${wait} detik sebelum meminta kode lagi.`, 'OTP_COOLDOWN', wait);
    await tx.staffLoginOtp.updateMany({ where: { phoneHash }, data: { consumedAt: now } });
    await tx.staffLoginOtp.create({ data: {
      id: challengeId, staffId: staff.id, purpose: enrollingStaffId ? 'enroll' : 'login', phone,
      phoneHash, requestIpHash, bindingHash: tokenHash(binding),
      codeHash: hashCode(challengeId, code), expiresAt: new Date(now.getTime() + OTP_TTL_SECONDS * 1000),
    } });
  });
  let submission: Awaited<ReturnType<typeof sendMemberOtp>>;
  try {
    submission = await sendMemberOtp(phone, code);
    // Legacy verification gate records provider acceptance, not device delivery.
    await prisma.staffLoginOtp.update({ where: { id: challengeId }, data: { deliveredAt: new Date() } });
  } catch {
    await prisma.staffLoginOtp.update({ where: { id: challengeId }, data: { consumedAt: new Date() } });
    throw new StaffAuthError(502, 'Kode belum dapat dikirim. Coba lagi nanti.', 'OTP_SEND_FAILED', 60);
  }
  try {
    if (submission?.messageId) await recordOtpSubmission('staff', challengeId, submission);
  } catch {
    console.error('[STAFF OTP] Delivery tracking unavailable');
  }
  return { challengeId, expiresInSeconds: OTP_TTL_SECONDS, resendAfterSeconds: OTP_RESEND_SECONDS,
    deliveryStatus: submission?.messageStatus || 'unspecified' };
}

async function consumeStaffOtp(challengeId: unknown, code: unknown, binding: string, purpose: 'login' | 'enroll', enrollingStaffId?: string): Promise<string> {
  if (!validToken(challengeId) || !validToken(binding) || typeof code !== 'string' || !/^\d{6}$/.test(code)) throw invalidCode();
  const result = await prisma.$transaction(async (tx) => {
    const initial = await tx.staffLoginOtp.findUnique({ where: { id: challengeId } });
    if (!initial || initial.purpose !== purpose || (enrollingStaffId && initial.staffId !== enrollingStaffId)
      || initial.bindingHash !== tokenHash(binding)) return null;
    await lock(tx, `phone:${initial.phoneHash}`);
    await tx.$queryRaw`SELECT id FROM staff_login_otps WHERE id = ${challengeId} FOR UPDATE`;
    const challenge = await tx.staffLoginOtp.findUniqueOrThrow({ where: { id: challengeId }, include: { staff: true } });
    const now = new Date();
    if (!challenge.staff.active || !challenge.deliveredAt || challenge.consumedAt || challenge.expiresAt <= now || challenge.attempts >= OTP_MAX_ATTEMPTS) return null;
    await tx.staffLoginOtp.update({ where: { id: challengeId }, data: { attempts: { increment: 1 } } });
    const expected = Buffer.from(challenge.codeHash, 'hex');
    const actual = Buffer.from(hashCode(challengeId, code), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    await tx.staffLoginOtp.update({ where: { id: challengeId }, data: { consumedAt: now } });
    if (purpose === 'enroll') {
      if (challenge.staff.phone) return null;
      await tx.staffAccount.update({ where: { id: challenge.staffId }, data: { phone: challenge.phone } });
      return 'verified';
    }
    return issueSessionTx(tx, challenge.staffId);
  }, { timeout: 15_000 });
  if (!result) throw invalidCode();
  return result;
}

export async function verifyStaffOtp(challengeId: unknown, code: unknown, binding: string): Promise<string> {
  return consumeStaffOtp(challengeId, code, binding, 'login');
}

export async function verifyStaffPhoneOtp(staffId: string, challengeId: unknown, code: unknown, binding: string): Promise<void> {
  try { await consumeStaffOtp(challengeId, code, binding, 'enroll', staffId); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new StaffAuthError(409, 'Nomor sudah digunakan oleh akun staf lain.', 'PHONE_CONFLICT');
    }
    throw error;
  }
}

export async function signInVerifiedGoogleStaff(identity: GoogleIdentity): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const staff = await tx.staffAccount.findUnique({ where: { googleSub: identity.sub } })
      || await tx.staffAccount.findUnique({ where: { email: identity.email.toLowerCase() } });
    if (!staff?.active || (staff.googleSub && staff.googleSub !== identity.sub)) {
      throw new StaffAuthError(403, 'Akun Google ini tidak memiliki akses staf.', 'STAFF_NOT_REGISTERED');
    }
    if (!staff.googleSub) {
      const bound = await tx.staffAccount.updateMany({ where: { id: staff.id, googleSub: null, active: true }, data: { googleSub: identity.sub } });
      if (bound.count !== 1) throw new StaffAuthError(403, 'Akun Google ini tidak memiliki akses staf.', 'STAFF_NOT_REGISTERED');
    }
    return issueSessionTx(tx, staff.id);
  });
}

export async function signInGoogleStaff(credential: unknown): Promise<string> {
  return signInVerifiedGoogleStaff(await verifyGoogleCredential(credential));
}
