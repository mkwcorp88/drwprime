import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';
import {
  createAffiliatorCrawlIndex,
  normalizeIndoPhone,
  resolveAffiliatorPhone,
  type AffiliatorCrawlDataset,
  type AffiliatorMatchSubject,
} from '@/lib/affiliator-phone-matcher';

const EMPTY_DATASET: AffiliatorCrawlDataset = {
  membersWithPhone: [],
  opsPatientsWithPhone: [],
  crmLeads: [],
  reservations: [],
  productOrders: [],
  staffAccounts: [],
  phoneRecoveries: [],
  preClaimCodes: [],
};

async function loadCrawlDataset(missingSubjects: AffiliatorMatchSubject[]): Promise<AffiliatorCrawlDataset> {
  if (missingSubjects.length === 0) return EMPTY_DATASET;

  const missingUserIds = missingSubjects.map((u) => u.id);
  const missingCodes = [...new Set(
    missingSubjects
      .map((u) => u.affiliateCode?.trim().toUpperCase())
      .filter((code): code is string => Boolean(code))
  )];

  const preClaimCodes = missingCodes.length > 0
    ? await prisma.preClaimAffiliateCode.findMany({
        where: { code: { in: missingCodes } },
        select: { code: true, assignedEmail: true, notes: true },
      })
    : [];

  const candidateEmails = [...new Set(
    [
      ...missingSubjects.map((u) => u.email?.trim()),
      ...preClaimCodes.map((p) => p.assignedEmail?.trim()),
    ].filter((email): email is string => Boolean(email && email.includes('@')))
  )];

  const [
    membersWithPhone,
    opsPatientsWithPhone,
    crmLeads,
    reservations,
    productOrders,
    staffAccounts,
    phoneRecoveries,
  ] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { phone: { not: null } },
          { loginPhone: { not: null } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        loginPhone: true,
        nomorRekamMedis: true,
      },
    }),
    prisma.opsPatient.findMany({
      where: { phone: { not: null } },
      select: {
        id: true,
        name: true,
        phone: true,
        mrNumber: true,
      },
    }),
    prisma.crmLead.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        phoneNormalized: true,
      },
    }),
    candidateEmails.length > 0
      ? prisma.reservation.findMany({
          where: { patientEmail: { in: candidateEmails, mode: 'insensitive' } },
          select: { patientName: true, patientEmail: true, patientPhone: true },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
    candidateEmails.length > 0
      ? prisma.productOrder.findMany({
          where: { customerEmail: { in: candidateEmails, mode: 'insensitive' } },
          select: { customerName: true, customerEmail: true, customerPhone: true },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
    prisma.staffAccount.findMany({
      where: { phone: { not: null } },
      select: { email: true, legacyClerkId: true, phone: true, name: true },
    }),
    prisma.memberPhoneRecovery.findMany({
      where: { userId: { in: missingUserIds } },
      select: { userId: true, phone: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    membersWithPhone,
    opsPatientsWithPhone,
    crmLeads,
    reservations,
    productOrders,
    staffAccounts,
    phoneRecoveries,
    preClaimCodes,
  };
}

export async function GET() {
  try {
    await requireAdmin();

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { affiliateCode: { not: null } },
          { affiliateCode: { not: '' } },
        ],
      },
      select: {
        id: true,
        clerkUserId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        loginPhone: true,
        affiliateCode: true,
        totalEarnings: true,
        createdAt: true,
        bankAccounts: {
          select: {
            accountName: true,
            isDefault: true,
          },
          orderBy: [
            { isDefault: 'desc' },
            { createdAt: 'desc' },
          ],
        },
        reservations: {
          select: {
            patientName: true,
            patientEmail: true,
            patientPhone: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        referrals: {
          where: { status: 'completed' },
          select: {
            id: true,
            commissionAmount: true,
          },
        },
        withdrawals: {
          where: { status: 'completed' },
          select: {
            id: true,
            amount: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const subjects: AffiliatorMatchSubject[] = users.map((user) => ({
      id: user.id,
      clerkUserId: user.clerkUserId,
      firstName: user.firstName || '',
      lastName: user.lastName || null,
      email: user.email || null,
      phone: user.phone || null,
      loginPhone: user.loginPhone || null,
      affiliateCode: user.affiliateCode || null,
      bankAccountNames: user.bankAccounts.map((b) => b.accountName).filter(Boolean),
      reservations: user.reservations,
    }));

    const missingDirectSubjects = subjects.filter(
      (subject) => !normalizeIndoPhone(subject.loginPhone) && !normalizeIndoPhone(subject.phone)
    );

    const crawlDataset = await loadCrawlDataset(missingDirectSubjects);
    const crawlIndex = createAffiliatorCrawlIndex(crawlDataset);

    const summary = {
      total: users.length,
      withPhoneCount: 0,
      verifiedCount: 0,
      exactCount: 0,
      highCount: 0,
      candidateCount: 0,
      missingCount: 0,
    };

    const affiliators = users.map((user, idx) => {
      const subject = subjects[idx];
      const resolution = resolveAffiliatorPhone(subject, crawlIndex);

      if (resolution.phone) summary.withPhoneCount += 1;
      if (resolution.confidence === 'verified') summary.verifiedCount += 1;
      else if (resolution.confidence === 'exact') summary.exactCount += 1;
      else if (resolution.confidence === 'high') summary.highCount += 1;
      else if (resolution.confidence === 'candidate') summary.candidateCount += 1;
      else summary.missingCount += 1;

      const totalCommission = user.referrals.reduce(
        (sum, r) => sum + Number(r.commissionAmount || 0),
        0
      );
      const totalReservations = user.referrals.length;
      const totalWithdrawn = user.withdrawals.reduce(
        (sum, w) => sum + Number(w.amount || 0),
        0
      );
      const remainingCommission = Number(user.totalEarnings || 0);

      return {
        id: user.id,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email,
        affiliateCode: user.affiliateCode,
        totalCommission,
        totalWithdrawn,
        remainingCommission,
        totalReservations,
        claimedAt: user.createdAt,
        phone: resolution.phone,
        displayPhone: resolution.displayPhone,
        phoneConfidence: resolution.confidence,
        phoneSource: resolution.source,
        phoneSourceLabel: resolution.sourceLabel,
        phoneReason: resolution.reason,
        matchedMemberName: resolution.matchedMemberName,
        matchedMrNumber: resolution.matchedMrNumber,
        bankAccountNames: subject.bankAccountNames,
        phoneCandidates: resolution.candidates,
      };
    });

    return NextResponse.json({
      success: true,
      affiliators,
      total: affiliators.length,
      summary,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('Error fetching affiliators:', error);
    return NextResponse.json(
      { error: 'Failed to fetch affiliators' },
      { status: 500 }
    );
  }
}
