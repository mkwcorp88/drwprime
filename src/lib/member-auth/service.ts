import { createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Prisma, User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { OTP_MAX_ATTEMPTS, OTP_RESEND_SECONDS, OTP_TTL_SECONDS, ENROLLMENT_TTL_SECONDS, MemberAuthError, normalizeLoginPhone, parseBirthDate } from './policy';
import { createMemberSessionTx, newToken, tokenHash, validToken } from './session';
import { requireMemberOtpConfig, sendMemberOtp } from './whatsapp';

type Tx = Prisma.TransactionClient;
const WINDOW_MS = 15 * 60 * 1000;
const invalid = () => new MemberAuthError(401, 'Kode tidak valid atau sudah kedaluwarsa. Silakan minta kode baru.', 'OTP_INVALID');
const enrollmentInvalid = () => new MemberAuthError(409, 'Data belum cocok atau verifikasi sudah berakhir. Periksa data Anda atau hubungi Front Office.', 'ENROLLMENT_INVALID');

function hmac(text: string): string {
  const secret = process.env.MEMBER_OTP_SECRET?.trim();
  if (!secret || secret.length < 32) throw new MemberAuthError(503, 'Layanan OTP belum dikonfigurasi.', 'OTP_NOT_CONFIGURED');
  return createHmac('sha256', secret).update(text).digest('hex');
}

export function hashMemberOtp(challengeId: string, code: string): string {
  return hmac(`code:${challengeId}:${code}`);
}

// Every competing operation uses the same sorted transaction locks. In
// particular cooldown/count checks and challenge insertion are one operation.
async function lock(tx: Tx, ...keys: string[]) {
  for (const key of [...new Set(keys)].sort()) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`member-auth:${key}`}, 0))::text`;
  }
}

async function contactCandidates(tx: Tx, phone: string) {
  return tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM users WHERE (
      CASE
        WHEN regexp_replace(phone, '[^0-9]', '', 'g') LIKE '62%' THEN regexp_replace(phone, '[^0-9]', '', 'g')
        WHEN regexp_replace(phone, '[^0-9]', '', 'g') LIKE '0%' THEN '62' || substr(regexp_replace(phone, '[^0-9]', '', 'g'), 2)
        WHEN regexp_replace(phone, '[^0-9]', '', 'g') LIKE '8%' THEN '62' || regexp_replace(phone, '[^0-9]', '', 'g')
        ELSE NULL
      END
    ) = ${phone} LIMIT 2`;
}

export async function requestMemberOtp(input: unknown, binding: string, ip: string) {
  requireMemberOtpConfig();
  const phone = normalizeLoginPhone(input);
  if (!validToken(binding)) throw invalid();
  const phoneHash = hmac(`phone:${phone}`);
  const requestIpHash = hmac(`ip:${ip}`);
  const now = new Date();
  const since = new Date(now.getTime() - WINDOW_MS);
  const challengeId = newToken();
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  await prisma.$transaction(async (tx) => {
    await lock(tx, `phone:${phone}`, `ip:${requestIpHash}`);
    const [latest, phoneCount, ipCount] = await Promise.all([
      tx.memberLoginOtp.findFirst({ where: { phoneHash }, orderBy: { createdAt: 'desc' } }),
      tx.memberLoginOtp.count({ where: { phoneHash, createdAt: { gte: since } } }),
      tx.memberLoginOtp.count({ where: { requestIpHash, createdAt: { gte: since } } }),
    ]);
    if (phoneCount >= 5 || ipCount >= 20) throw new MemberAuthError(429, 'Terlalu banyak permintaan. Coba lagi dalam 15 menit.', 'OTP_RATE_LIMITED', 900);
    const wait = latest ? Math.ceil((latest.createdAt.getTime() + OTP_RESEND_SECONDS * 1000 - now.getTime()) / 1000) : 0;
    if (wait > 0) throw new MemberAuthError(429, `Tunggu ${wait} detik sebelum meminta kode lagi.`, 'OTP_COOLDOWN', wait);
    await tx.memberLoginOtp.updateMany({ where: { phoneHash }, data: { consumedAt: now, grantHash: null } });
    await tx.memberLoginOtp.create({ data: {
      id: challengeId, phone, phoneHash, requestIpHash, bindingHash: tokenHash(binding),
      codeHash: hashMemberOtp(challengeId, code), createdAt: now,
      expiresAt: new Date(now.getTime() + OTP_TTL_SECONDS * 1000),
    } });
  });
  try {
    await sendMemberOtp(phone, code);
    await prisma.memberLoginOtp.update({ where: { id: challengeId }, data: { deliveredAt: new Date() } });
  } catch (error) {
    // Retain failed deliveries for rate accounting. Never make them verifiable.
    await prisma.memberLoginOtp.update({ where: { id: challengeId }, data: { consumedAt: new Date() } });
    throw error;
  }
  await prisma.memberLoginOtp.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 86_400_000) } } });
  return { challengeId, phone, expiresInSeconds: OTP_TTL_SECONDS, resendAfterSeconds: OTP_RESEND_SECONDS };
}

async function activateMember(tx: Tx, user: User, phone: string) {
  let affiliateCode = user.affiliateCode;
  if (!affiliateCode) affiliateCode = await allocateAffiliateCode(tx, user.firstName);
  await tx.user.update({ where: { id: user.id }, data: {
    loginPhone: phone, loginPhoneVerifiedAt: new Date(), memberLoginBlockedAt: null,
    hasAccount: true, affiliateCode, isTeamLeader: user.affiliateCode ? user.isTeamLeader : true,
    qrToken: user.qrToken || randomUUID(),
  } });
  await tx.memberSession.deleteMany({ where: { userId: user.id } });
  return createMemberSessionTx(tx, user.id);
}

async function allocateAffiliateCode(tx: Tx, name: string) {
  await lock(tx, 'affiliate-allocation');
  for (let i = 0; i < 10; i++) {
    const code = `${name.replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase().padEnd(2, 'X')}${randomBytes(3).toString('hex').toUpperCase()}`;
    const existing = await tx.user.findFirst({ where: { affiliateCode: code }, select: { id: true } });
    const reserved = await tx.preClaimAffiliateCode.findUnique({ where: { code }, select: { id: true } });
    if (!existing && !reserved) return code;
  }
  throw new MemberAuthError(503, 'Akun belum dapat disiapkan. Coba lagi.', 'REGISTRATION_FAILED');
}

type ProofResult =
  | { kind: 'invalid' }
  | { kind: 'support' }
  | { kind: 'session'; sessionToken: string }
  | { kind: 'enroll'; grantToken: string; stage: 'register' | 'activate'; phone: string };

export async function verifyMemberOtp(challengeId: unknown, code: unknown, binding: string): Promise<ProofResult> {
  if (!validToken(challengeId) || !validToken(binding) || typeof code !== 'string' || !/^\d{6}$/.test(code)) throw invalid();
  const result = await prisma.$transaction(async (tx): Promise<ProofResult> => {
    const initial = await tx.memberLoginOtp.findUnique({ where: { id: challengeId } });
    if (!initial || initial.bindingHash !== tokenHash(binding)) return { kind: 'invalid' };
    await lock(tx, `phone:${initial.phone}`);
    await tx.$queryRaw`SELECT id FROM member_login_otps WHERE id = ${challengeId} FOR UPDATE`;
    const challenge = await tx.memberLoginOtp.findUniqueOrThrow({ where: { id: challengeId } });
    const now = new Date();
    if (!challenge.deliveredAt || challenge.consumedAt || challenge.expiresAt <= now || challenge.attempts >= OTP_MAX_ATTEMPTS) return { kind: 'invalid' };
    await tx.memberLoginOtp.update({ where: { id: challengeId }, data: { attempts: { increment: 1 } } });
    const expected = Buffer.from(challenge.codeHash, 'hex');
    const actual = Buffer.from(hashMemberOtp(challengeId, code), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return { kind: 'invalid' };
    await tx.memberLoginOtp.update({ where: { id: challengeId }, data: { consumedAt: now, verifiedAt: now } });

    const recovery = await tx.memberPhoneRecovery.findFirst({ where: { phone: challenge.phone, consumedAt: null, expiresAt: { gt: now } } });
    if (recovery) {
      await lock(tx, `user:${recovery.userId}`);
      const user = await tx.user.findUnique({ where: { id: recovery.userId } });
      const activeRecovery = await tx.memberPhoneRecovery.findFirst({ where: { id: recovery.id, consumedAt: null, expiresAt: { gt: now } } });
      const owner = await tx.user.findUnique({ where: { loginPhone: challenge.phone } });
      const candidates = await contactCandidates(tx, challenge.phone);
      if (!user || !activeRecovery || (owner && owner.id !== user.id) || candidates.some((candidate) => candidate.id !== user.id)) return { kind: 'support' };
      await tx.memberPhoneRecovery.update({ where: { id: recovery.id }, data: { consumedAt: now } });
      return { kind: 'session', sessionToken: await activateMember(tx, user, challenge.phone) };
    }

    const owner = await tx.user.findUnique({ where: { loginPhone: challenge.phone } });
    if (owner) {
      await lock(tx, `user:${owner.id}`);
      const current = await tx.user.findUniqueOrThrow({ where: { id: owner.id } });
      if (current.loginPhone !== challenge.phone || current.memberLoginBlockedAt || !current.loginPhoneVerifiedAt || !current.hasAccount) return { kind: 'support' };
      return { kind: 'session', sessionToken: await createMemberSessionTx(tx, current.id) };
    }

    const candidates = await contactCandidates(tx, challenge.phone);
    if (candidates.length > 1) return { kind: 'support' };
    const target = candidates[0] ? await tx.user.findUnique({ where: { id: candidates[0].id } }) : null;
    // Existing patient records require the pre-existing date of birth. Never expose
    // a balance or merge an account based on phone alone.
    if (target && (target.loginPhone || target.memberLoginBlockedAt || !target.dateOfBirth)) return { kind: 'support' };
    const grantToken = newToken();
    await tx.memberLoginOtp.update({ where: { id: challengeId }, data: {
      grantHash: tokenHash(grantToken), grantExpiresAt: new Date(now.getTime() + ENROLLMENT_TTL_SECONDS * 1000), targetUserId: target?.id,
    } });
    return { kind: 'enroll', grantToken, phone: challenge.phone, stage: target ? 'activate' : 'register' };
  }, { timeout: 15_000 });
  if (result.kind === 'invalid') throw invalid();
  return result;
}

export async function pendingEnrollment(grant: string | undefined, binding: string | undefined) {
  if (!validToken(grant) || !validToken(binding)) return null;
  const challenge = await prisma.memberLoginOtp.findUnique({ where: { grantHash: tokenHash(grant) } });
  if (!challenge?.verifiedAt || challenge.bindingHash !== tokenHash(binding) || !challenge.grantExpiresAt || challenge.grantExpiresAt <= new Date() || challenge.enrollmentAttempts >= 5) return null;
  return { stage: challenge.targetUserId ? 'activate' as const : 'register' as const, phone: challenge.phone };
}

export async function enrollMember(grant: string, binding: string, input: Record<string, unknown>): Promise<string> {
  if (!validToken(grant) || !validToken(binding)) throw enrollmentInvalid();
  const result = await prisma.$transaction(async (tx) => {
    const initial = await tx.memberLoginOtp.findUnique({ where: { grantHash: tokenHash(grant) } });
    if (!initial || initial.bindingHash !== tokenHash(binding)) return null;
    await lock(tx, `phone:${initial.phone}`);
    await tx.$queryRaw`SELECT id FROM member_login_otps WHERE id = ${initial.id} FOR UPDATE`;
    const challenge = await tx.memberLoginOtp.findUniqueOrThrow({ where: { id: initial.id } });
    if (!challenge.verifiedAt || challenge.grantHash !== tokenHash(grant) || !challenge.grantExpiresAt || challenge.grantExpiresAt <= new Date() || challenge.enrollmentAttempts >= 5) return null;
    await tx.memberLoginOtp.update({ where: { id: challenge.id }, data: { enrollmentAttempts: { increment: 1 } } });
    const candidates = await contactCandidates(tx, challenge.phone);
    const loginOwner = await tx.user.findUnique({ where: { loginPhone: challenge.phone }, select: { id: true } });
    if (loginOwner) return null;

    let user: User;
    if (challenge.targetUserId) {
      if (candidates.length !== 1 || candidates[0].id !== challenge.targetUserId) return null;
      await lock(tx, `user:${challenge.targetUserId}`);
      const target = await tx.user.findUnique({ where: { id: challenge.targetUserId } });
      const birthDate = parseBirthDate(input.dateOfBirth);
      if (!target || target.loginPhone || target.memberLoginBlockedAt || !target.dateOfBirth || !birthDate
        || birthDate.toISOString().slice(0, 10) !== target.dateOfBirth.toISOString().slice(0, 10)) return null;
      user = target;
    } else {
      if (candidates.length) return null;
      const name = typeof input.firstName === 'string' ? input.firstName.trim() : '';
      const lastName = typeof input.lastName === 'string' ? input.lastName.trim() : '';
      const email = typeof input.email === 'string' ? input.email.trim() : '';
      const referral = typeof input.referralCode === 'string' ? input.referralCode.trim().toUpperCase() : '';
      if (name.length < 2 || name.length > 100 || lastName.length > 100 || email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return null;
      const team = referral ? await tx.user.findFirst({ where: { affiliateCode: referral, isTeamLeader: true }, select: { affiliateCode: true } }) : null;
      if (referral && (!/^[A-Z0-9]{5,10}$/.test(referral) || !team)) return null;
      const affiliateCode = team?.affiliateCode || await allocateAffiliateCode(tx, name);
      user = await tx.user.create({ data: {
        firstName: name, lastName: lastName || null, email: email || null, phone: challenge.phone,
        affiliateCode, isTeamLeader: !team, hasAccount: true, qrToken: randomUUID(),
        // An unverified profile email is never an authorization/claim signal.
        isAdmin: false,
      } });
    }
    await tx.memberLoginOtp.update({ where: { id: challenge.id }, data: { grantHash: null } });
    return activateMember(tx, user, challenge.phone);
  }, { timeout: 15_000 });
  if (!result) throw enrollmentInvalid();
  return result;
}

export async function approveMemberPhoneRecovery(userId: string, input: unknown, reason: unknown, actorClerkId: string) {
  const phone = normalizeLoginPhone(input);
  if (typeof reason !== 'string' || reason.trim().length < 10 || reason.length > 500) throw new MemberAuthError(400, 'Catat hasil verifikasi identitas (10–500 karakter).', 'REASON_REQUIRED');
  return prisma.$transaction(async (tx) => {
    await lock(tx, `phone:${phone}`, `user:${userId}`);
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new MemberAuthError(404, 'Member tidak ditemukan.', 'MEMBER_NOT_FOUND');
    const owner = await tx.user.findUnique({ where: { loginPhone: phone }, select: { id: true } });
    const candidates = await contactCandidates(tx, phone);
    if ((owner && owner.id !== userId) || candidates.some((candidate) => candidate.id !== userId)) throw new MemberAuthError(409, 'Nomor terkait dengan member lain. Periksa data sebelum melanjutkan.', 'PHONE_CONFLICT');
    const expiresAt = new Date(Date.now() + 86_400_000);
    await tx.memberPhoneRecovery.updateMany({ where: { OR: [{ userId }, { phone }], consumedAt: null }, data: { consumedAt: new Date() } });
    await tx.user.update({ where: { id: userId }, data: { memberLoginBlockedAt: new Date() } });
    await tx.memberSession.deleteMany({ where: { userId } });
    const recovery = await tx.memberPhoneRecovery.create({ data: { userId, phone, reason: reason.trim(), approvedByClerkId: actorClerkId, expiresAt } });
    return { expiresAt: recovery.expiresAt, phone };
  });
}
