import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { ensureUniqueAffiliateCode } from '@/lib/affiliate';
import { requireUser, handleAuthError } from '@/lib/auth';
import { isHardcodedAdmin } from '@/lib/admin';
import { normalizePhone } from '@/lib/phone';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(req: Request) {
  try {
    const authUser = await requireUser();
    const { clerkUserId } = authUser;

    // Identity comes from Clerk — NEVER from request body.
    const email = authUser.primaryEmail;
    const firstName = authUser.firstName || email?.split('@')[0] || 'Member';
    const lastName = authUser.lastName;

    const body = await req.json();
    const referralCode = typeof body.referralCode === 'string' && body.referralCode.trim()
      ? body.referralCode.trim()
      : null;
    const rawPhone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null;
    const normalizedPhone = rawPhone ? normalizePhone(rawPhone) : null;

    if (normalizedPhone && !/^62\d{8,13}$/.test(normalizedPhone)) {
      return NextResponse.json({ error: 'Format nomor HP tidak valid' }, { status: 400 });
    }
    if (normalizedPhone && !authUser.verifiedPhones.includes(normalizedPhone)) {
      return NextResponse.json(
        { error: 'Verifikasi nomor HP di akun terlebih dahulu' },
        { status: 409 },
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (existingUser) {
      return NextResponse.json({ user: existingUser });
    }

    let walkInMember: { id: string; clerkUserId: string | null } | null = null;

    if (normalizedPhone) {
      walkInMember = await prisma.user.findUnique({
        where: { phone: normalizedPhone },
        select: {
          id: true,
          clerkUserId: true,
        },
      });

      if (walkInMember?.clerkUserId) {
        return NextResponse.json(
          { error: 'Nomor HP ini sudah terdaftar di akun lain' },
          { status: 409 },
        );
      }
    }

    let affiliateCode: string;
    let isTeamLeader = false;

    const preAssignedCode = email
      ? await prisma.preClaimAffiliateCode.findFirst({
          where: { assignedEmail: email, status: 'unclaimed' },
        })
      : null;

    if (preAssignedCode) {
      affiliateCode = preAssignedCode.code;
      isTeamLeader = true;
      console.log(`[AFFILIATE] Auto-claiming pre-assigned code ${affiliateCode} for email ${email}`);
    } else if (referralCode) {
      const existingCodeUser = await prisma.user.findFirst({
        where: { affiliateCode: referralCode },
      });

      if (existingCodeUser) {
        affiliateCode = referralCode;
        isTeamLeader = false;
      } else {
        affiliateCode = referralCode;
        isTeamLeader = true;
        console.log(`[AFFILIATE] Claiming unclaimed code: ${referralCode}`);
      }
    } else {
      affiliateCode = await ensureUniqueAffiliateCode(
        firstName,
        lastName || '',
        async (code) => {
          const exists = await prisma.user.findFirst({ where: { affiliateCode: code } });
          return !exists;
        },
      );
      isTeamLeader = true;
    }

    // isAdmin determined ONLY by hardcoded Clerk user ID list — never by email.
    const isAdmin = isHardcodedAdmin(clerkUserId);

    // A matching walk-in record may contain medical or financial data. Keep the
    // phone unclaimed until profile completion supplies a second identity factor.
    const user = await prisma.user.create({
      data: {
        clerkUserId,
        email,
        firstName,
        lastName,
        phone: walkInMember ? null : normalizedPhone,
        affiliateCode,
        isTeamLeader,
        hasAccount: true,
        isAdmin,
        qrToken: randomUUID(),
      },
    });

    if (isTeamLeader && (preAssignedCode || referralCode)) {
      const codeToUpdate = preAssignedCode?.code || referralCode;

      await prisma.preClaimAffiliateCode.updateMany({
        where: { code: codeToUpdate, status: 'unclaimed' },
        data: { status: 'claimed', claimedBy: user.id, claimedAt: new Date() },
      });

      console.log(`[AFFILIATE] Updated PreClaimAffiliateCode status to claimed for: ${codeToUpdate}`);

      const pendingReservations = await prisma.reservation.findMany({
        where: { referredBy: codeToUpdate, referrerId: null },
      });

      if (pendingReservations.length > 0) {
        await prisma.reservation.updateMany({
          where: { referredBy: codeToUpdate, referrerId: null },
          data: { referrerId: user.id },
        });

        console.log(`[AFFILIATE] Transferred ${pendingReservations.length} pending reservations to user ${user.id}`);
      }
    }

    return NextResponse.json({
      user,
      identityVerificationRequired: Boolean(walkInMember),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('Error syncing user:', error);
    return NextResponse.json(
      { error: 'Failed to sync user' },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const { clerkUserId } = await requireUser();

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      include: {
        reservations: { include: { treatment: true }, orderBy: { createdAt: 'desc' } },
        referrals: {
          where: { status: 'completed' },
          include: { treatment: true },
          orderBy: { createdAt: 'desc' },
        },
        transactions: { orderBy: { createdAt: 'desc' }, take: 10 },
        bankAccounts: { orderBy: { createdAt: 'desc' } },
        withdrawals: { include: { bankAccount: true }, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!user) {
      return NextResponse.json({ user: null, needsSync: true }, { status: 200 });
    }

    // isAdmin from hardcoded list — never trusted from request body or email alone.
    const isAdmin = isHardcodedAdmin(clerkUserId) || user.isAdmin;
    if (isAdmin && !user.isAdmin) {
      await prisma.user.update({
        where: { clerkUserId },
        data: { isAdmin: true },
      });
    }

    const totalReferrals = user.referrals.length;
    const loyaltyLevel = getLoyaltyLevel(user.loyaltyPoints);

    const teamMembersCount = await prisma.user.count({
      where: { affiliateCode: user.affiliateCode, clerkUserId: { not: clerkUserId } },
    });

    return NextResponse.json({
      user: {
        ...user,
        phone: user.phone ? normalizePhone(user.phone) : null,
        isAdmin,
        totalReferrals,
        loyaltyLevel,
        teamMembersCount,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

function getLoyaltyLevel(points: number): string {
  if (points >= 10000) return 'Platinum';
  if (points >= 5000) return 'Gold';
  if (points >= 1000) return 'Silver';
  return 'Bronze';
}
