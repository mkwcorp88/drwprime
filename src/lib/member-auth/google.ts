import { OAuth2Client } from 'google-auth-library';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { MemberAuthError } from './policy';
import { createMemberSessionTx } from './session';

const verifier = new OAuth2Client();

export type GoogleIdentity = {
  sub: string;
  email: string;
  firstName: string;
  lastName: string | null;
};

// Google Identity Services sends an ID token, not an email or an OAuth access
// token. The Google library verifies its signature, issuer, expiry and audience.
export async function verifyGoogleCredential(credential: unknown): Promise<GoogleIdentity> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  if (!clientId) throw new MemberAuthError(503, 'Login Google belum dikonfigurasi.', 'GOOGLE_NOT_CONFIGURED');
  if (typeof credential !== 'string' || credential.length < 100 || credential.length > 8192) {
    throw new MemberAuthError(400, 'Kredensial Google tidak valid.', 'GOOGLE_CREDENTIAL_INVALID');
  }
  try {
    const ticket = await verifier.verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || payload.sub.length > 255 || payload.email_verified !== true
      || !payload.email || payload.email.length > 254) throw new Error('Google identity incomplete');
    return {
      sub: payload.sub,
      email: payload.email,
      firstName: (payload.given_name?.trim() || payload.name?.trim().split(/\s+/)[0] || 'Member').slice(0, 100),
      lastName: payload.family_name?.trim().slice(0, 100) || null,
    };
  } catch {
    throw new MemberAuthError(401, 'Verifikasi Google gagal. Silakan coba lagi.', 'GOOGLE_CREDENTIAL_INVALID');
  }
}

type GoogleSession = { token: string; phoneVerified: boolean };

async function existingGoogleMember(tx: Prisma.TransactionClient, sub: string): Promise<GoogleSession | null> {
  const account = await tx.memberGoogleAccount.findUnique({ where: { googleSub: sub }, include: { user: true } });
  if (!account) return null;
  const member = account.user;
  if (!member.hasAccount || member.memberLoginBlockedAt) {
    throw new MemberAuthError(403, 'Login member sedang dibatasi. Hubungi Front Office.', 'MEMBER_BLOCKED');
  }
  return { token: await createMemberSessionTx(tx, member.id), phoneVerified: Boolean(member.loginPhone && member.loginPhoneVerifiedAt) };
}

// A verified Google subject creates its own member account. Never claim an
// existing patient by email; that happens only after explicit WhatsApp proof.
export async function signInGoogleMember(identity: GoogleIdentity, referralCode?: unknown): Promise<GoogleSession> {
  const referral = typeof referralCode === 'string' ? referralCode.trim().toUpperCase() : '';
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await existingGoogleMember(tx, identity.sub);
      if (existing) return existing;

      let affiliateCode: string | null = null;
      if (referral) {
        if (!/^[A-Z0-9]{5,10}$/.test(referral)) {
          throw new MemberAuthError(400, 'Kode afiliasi tidak valid.', 'REFERRAL_INVALID');
        }
        const team = await tx.user.findFirst({ where: { affiliateCode: referral, isTeamLeader: true }, select: { affiliateCode: true } });
        if (!team) throw new MemberAuthError(400, 'Kode afiliasi tidak valid.', 'REFERRAL_INVALID');
        affiliateCode = team.affiliateCode;
      }
      const member = await tx.user.create({ data: {
        firstName: identity.firstName, lastName: identity.lastName, email: identity.email,
        hasAccount: true, isAdmin: false, isTeamLeader: false,
      } });
      await tx.memberGoogleAccount.create({ data: { googleSub: identity.sub, userId: member.id, pendingReferralCode: affiliateCode } });
      return { token: await createMemberSessionTx(tx, member.id), phoneVerified: false };
    });
  } catch (error) {
    // A simultaneous first login may have created this Google subject already.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.$transaction((tx) => existingGoogleMember(tx, identity.sub));
      if (existing) return existing;
    }
    throw error;
  }
}
