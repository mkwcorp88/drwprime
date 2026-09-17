import { NextResponse } from 'next/server';
import { requireMember } from '@/lib/member-auth/session';
import { memberError, memberResponse } from '@/lib/member-auth/http';
import { prisma } from '@/lib/prisma';

const TIER_THRESHOLDS = {
  SILVER: 0,
  GOLD: 5_000_000,
  PLATINUM: 10_000_000,
};

const TIER_BENEFITS = {
  Silver: [
    'Priority booking',
    'Diskon ulang tahun 10%',
    'Akses promo eksklusif member',
    'Free skin check bulanan',
    'Diskon 15% setiap kunjungan',
    'Early access treatment baru',
  ],
  Gold: [
    'Semua benefit Silver',
    'Personal beauty consultant',
    'Diskon 20% setiap kunjungan',
    'Free treatment setiap kuartal',
    'Layanan VIP & priority queue',
  ],
  Platinum: [
    'Semua benefit Gold',
    'Konsultan kecantikan 24/7',
    'Free treatment setiap bulan',
    'Undangan event eksklusif DRW',
    'Gift spesial ulang tahun',
  ],
};

function computeTier(totalSpending: number): {
  tier: 'Silver' | 'Gold' | 'Platinum';
  benefits: string[];
  nextTier: 'Gold' | 'Platinum' | null;
  nextTierThreshold: number | null;
  progressPercent: number;
  amountToNextTier: number | null;
} {
  if (totalSpending >= TIER_THRESHOLDS.PLATINUM) {
    return {
      tier: 'Platinum',
      benefits: TIER_BENEFITS.Platinum,
      nextTier: null,
      nextTierThreshold: null,
      progressPercent: 100,
      amountToNextTier: null,
    };
  }
  if (totalSpending >= TIER_THRESHOLDS.GOLD) {
    const progress = Math.min(100, Math.round(
      ((totalSpending - TIER_THRESHOLDS.GOLD) / (TIER_THRESHOLDS.PLATINUM - TIER_THRESHOLDS.GOLD)) * 100
    ));
    return {
      tier: 'Gold',
      benefits: TIER_BENEFITS.Gold,
      nextTier: 'Platinum',
      nextTierThreshold: TIER_THRESHOLDS.PLATINUM,
      progressPercent: progress,
      amountToNextTier: TIER_THRESHOLDS.PLATINUM - totalSpending,
    };
  }
  const progress = Math.min(100, Math.round(
    (totalSpending / TIER_THRESHOLDS.GOLD) * 100
  ));
  return {
    tier: 'Silver',
    benefits: TIER_BENEFITS.Silver,
    nextTier: 'Gold',
    nextTierThreshold: TIER_THRESHOLDS.GOLD,
    progressPercent: progress,
    amountToNextTier: TIER_THRESHOLDS.GOLD - totalSpending,
  };
}

export async function GET() {
  try {
    const member = await requireMember();

    const user = await prisma.user.findUnique({
      where: { id: member.id },
      include: {
        reservations: {
          orderBy: { createdAt: 'desc' },
          include: {
            treatment: { select: { name: true } },
          },
        },
        spendingRecords: {
          orderBy: { spendingDate: 'desc' },
          select: {
            id: true,
            amount: true,
            treatment: true,
            spendingDate: true,
            pointsEarned: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const totalSpending = Number(user.totalSpending);

    const tierData = computeTier(totalSpending);

    return memberResponse({
      membership: {
        ...tierData,
        totalSpending,
        memberSince: user.memberSince,
        isTeamLeader: user.isTeamLeader,
        points: user.points,
        pointHistory: user.spendingRecords
          .filter((s) => s.pointsEarned > 0)
          .slice(0, 20)
          .map((s) => ({
            id: s.id,
            amount: Number(s.amount),
            treatment: s.treatment,
            spendingDate: s.spendingDate,
            pointsEarned: s.pointsEarned,
          })),
        reservations: user.reservations.slice(0, 20).map((r) => ({
          id: r.id,
          patientName: r.patientName,
          treatmentName: r.treatment?.name ?? null,
          status: r.status,
          reservationDate: r.reservationDate,
          finalPrice: Number(r.finalPrice),
        })),
      },
    });
  } catch (error) {
    return memberError(error);
  }
}
