import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { OpsStaff } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendOpsLoginOtpWhatsApp } from '@/lib/whatsapp';
import { completeOpsLogin } from './auth';
import { isOpsWhatsAppOtpEnabled } from './auth-mode';
import { normalizeOpsPhone, validateOpsPhone } from './profile';
import { OpsError } from './utils';

export const OPS_OTP_LENGTH = 6;
export const OPS_OTP_TTL_SECONDS = 5 * 60;
export const OPS_OTP_RESEND_SECONDS = 60;
export const OPS_OTP_MAX_ATTEMPTS = 5;

const OTP_RATE_WINDOW_MS = 15 * 60 * 1000;
const OTP_PHONE_REQUEST_LIMIT = 5;
const OTP_IP_REQUEST_LIMIT = 20;
const OTP_RETENTION_MS = 24 * 60 * 60 * 1000;

function getOtpSecret(): string {
  const configured = process.env.OPS_OTP_SECRET?.trim();
  const fallback = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const secret = (configured && configured.length >= 32 ? configured : fallback) || '';
  if (!secret) {
    throw new OpsError(500, 'Layanan OTP WhatsApp belum dikonfigurasi.', 'OTP_NOT_CONFIGURED');
  }
  return secret;
}

function otpHmac(value: string): string {
  return createHmac('sha256', getOtpSecret()).update(value).digest('hex');
}

function hashIdentifier(kind: 'phone' | 'ip', value: string): string {
  return otpHmac(`${kind}:${value}`);
}

export function createOpsOtpCode(): string {
  return randomInt(10 ** (OPS_OTP_LENGTH - 1), 10 ** OPS_OTP_LENGTH).toString();
}

export function hashOpsOtpCode(challengeId: string, code: string): string {
  return otpHmac(`code:${challengeId}:${code}`);
}

function otpMatches(expectedHash: string, actualHash: string): boolean {
  const expected = Buffer.from(expectedHash, 'hex');
  const actual = Buffer.from(actualHash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function invalidOtp(): never {
  throw new OpsError(401, 'Kode OTP tidak valid atau sudah kedaluwarsa.', 'OTP_INVALID');
}

export type OpsOtpRequestResult = {
  challengeId: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
};

export async function requestOpsLoginOtp(phoneInput: string, requestIp?: string): Promise<OpsOtpRequestResult> {
  if (!isOpsWhatsAppOtpEnabled()) {
    throw new OpsError(403, 'Login WhatsApp OTP sedang dinonaktifkan.', 'OTP_DISABLED');
  }

  const phoneError = validateOpsPhone(phoneInput);
  if (phoneError) throw new OpsError(422, phoneError, 'PHONE_INVALID');

  const phone = normalizeOpsPhone(phoneInput);
  const phoneHash = hashIdentifier('phone', phone);
  const normalizedIp = requestIp?.trim();
  const requestIpHash = normalizedIp ? hashIdentifier('ip', normalizedIp) : null;
  const now = new Date();
  const rateWindowStart = new Date(now.getTime() - OTP_RATE_WINDOW_MS);

  await prisma.opsLoginOtp.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - OTP_RETENTION_MS) } },
  });

  const [staff, latestChallenge, phoneRequests, ipRequests] = await Promise.all([
    prisma.opsStaff.findUnique({ where: { phone }, select: { id: true, active: true } }),
    prisma.opsLoginOtp.findFirst({
      where: { phoneHash, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.opsLoginOtp.count({ where: { phoneHash, createdAt: { gte: rateWindowStart } } }),
    requestIpHash
      ? prisma.opsLoginOtp.count({ where: { requestIpHash, createdAt: { gte: rateWindowStart } } })
      : Promise.resolve(0),
  ]);

  if (phoneRequests >= OTP_PHONE_REQUEST_LIMIT || ipRequests >= OTP_IP_REQUEST_LIMIT) {
    throw new OpsError(429, 'Terlalu banyak permintaan OTP. Coba lagi dalam 15 menit.', 'OTP_RATE_LIMITED');
  }

  if (latestChallenge) {
    const resendAt = latestChallenge.createdAt.getTime() + OPS_OTP_RESEND_SECONDS * 1000;
    if (resendAt > now.getTime() && latestChallenge.expiresAt > now) {
      return {
        challengeId: latestChallenge.id,
        expiresInSeconds: Math.max(1, Math.ceil((latestChallenge.expiresAt.getTime() - now.getTime()) / 1000)),
        resendAfterSeconds: Math.max(1, Math.ceil((resendAt - now.getTime()) / 1000)),
      };
    }
  }

  const challengeId = randomBytes(24).toString('base64url');
  const code = createOpsOtpCode();
  const expiresAt = new Date(now.getTime() + OPS_OTP_TTL_SECONDS * 1000);
  const activeStaff = staff?.active ? staff : null;

  const createdChallenge = await prisma.opsLoginOtp.create({
    data: {
      id: challengeId,
      staffId: activeStaff?.id ?? null,
      phoneHash,
      requestIpHash,
      codeHash: hashOpsOtpCode(challengeId, code),
      expiresAt,
    },
  });

  if (activeStaff) {
    try {
      await sendOpsLoginOtpWhatsApp(phone, code);
    } catch (error) {
      await prisma.opsLoginOtp.deleteMany({ where: { id: challengeId } });
      console.error('[TREATMENT OPS] Gagal mengirim OTP WhatsApp:', error);
      throw new OpsError(500, 'Kode OTP belum dapat dikirim. Coba lagi.', 'OTP_SEND_FAILED');
    }
  }

  await prisma.opsLoginOtp.updateMany({
    where: {
      phoneHash,
      id: { not: challengeId },
      consumedAt: null,
      createdAt: { lt: createdChallenge.createdAt },
    },
    data: { consumedAt: now },
  });

  return {
    challengeId,
    expiresInSeconds: OPS_OTP_TTL_SECONDS,
    resendAfterSeconds: OPS_OTP_RESEND_SECONDS,
  };
}

export async function verifyOpsLoginOtp(challengeId: string, code: string): Promise<OpsStaff> {
  if (!isOpsWhatsAppOtpEnabled()) {
    throw new OpsError(403, 'Login WhatsApp OTP sedang dinonaktifkan.', 'OTP_DISABLED');
  }
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(challengeId) || !/^\d{6}$/.test(code)) invalidOtp();

  const challenge = await prisma.opsLoginOtp.findUnique({
    where: { id: challengeId },
    include: { staff: true },
  });
  const now = new Date();

  if (
    !challenge ||
    challenge.consumedAt ||
    challenge.expiresAt <= now ||
    challenge.attempts >= OPS_OTP_MAX_ATTEMPTS ||
    !challenge.staff ||
    !challenge.staff.active ||
    !challenge.staff.phone ||
    hashIdentifier('phone', normalizeOpsPhone(challenge.staff.phone)) !== challenge.phoneHash
  ) {
    invalidOtp();
  }

  const matches = otpMatches(challenge.codeHash, hashOpsOtpCode(challenge.id, code));
  if (!matches) {
    await prisma.opsLoginOtp.updateMany({
      where: { id: challenge.id, consumedAt: null, attempts: challenge.attempts },
      data: { attempts: { increment: 1 } },
    });
    invalidOtp();
  }

  const consumed = await prisma.opsLoginOtp.updateMany({
    where: {
      id: challenge.id,
      consumedAt: null,
      expiresAt: { gt: now },
      attempts: challenge.attempts,
    },
    data: { consumedAt: now },
  });
  if (consumed.count !== 1) invalidOtp();

  await prisma.opsLoginOtp.updateMany({
    where: { staffId: challenge.staff.id, consumedAt: null },
    data: { consumedAt: now },
  });

  return completeOpsLogin(challenge.staff.id);
}
