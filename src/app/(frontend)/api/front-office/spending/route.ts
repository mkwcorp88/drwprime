import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';
import { isAidoManagedSpendingDate } from '@/lib/aido/config';

const TIER_THRESHOLDS = { SILVER: 1_000_000, GOLD: 5_000_000, PLATINUM: 10_000_000 };
const RUPIAH_PER_POINT = 10_000; // Rp 10.000 = 1 poin

function computeTier(totalSpending: number): 'Bronze' | 'Silver' | 'Gold' | 'Platinum' {
  if (totalSpending >= TIER_THRESHOLDS.PLATINUM) return 'Platinum';
  if (totalSpending >= TIER_THRESHOLDS.GOLD) return 'Gold';
  if (totalSpending >= TIER_THRESHOLDS.SILVER) return 'Silver';
  return 'Bronze';
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const { userId } = await auth();
    const body = await req.json();

    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const amount = Number(body.amount);
    const treatment = typeof body.treatment === 'string' ? body.treatment.trim() : '';
    const dateInput = typeof body.date === 'string' ? body.date.trim() : '';

    if (!token) {
      return NextResponse.json({ error: 'Token member wajib ada' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Nominal spending tidak valid' }, { status: 400 });
    }

    let spendingDate = new Date();
    if (dateInput) {
      const parsed = /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
        ? new Date(`${dateInput}T00:00:00+07:00`)
        : new Date(dateInput);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'Tanggal tidak valid' }, { status: 400 });
      }
      spendingDate = parsed;
    }
    if (isAidoManagedSpendingDate(spendingDate)) {
      return NextResponse.json(
        { error: 'Spending dicatat otomatis dari AIDO setelah cutover.' },
        { status: 409 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { qrToken: token },
      select: { id: true, lastTransactionAt: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Member tidak ditemukan. QR tidak valid.' }, { status: 404 });
    }

    const pointsEarned = Math.floor(amount / RUPIAH_PER_POINT);

    const updatedUser = await prisma.$transaction(async (tx) => {
      await tx.spendingRecord.create({
        data: {
          userId: user.id,
          amount,
          treatment: treatment || null,
          spendingDate,
          recordedByClerkId: userId ?? null,
          source: 'scan',
          pointsEarned,
        },
      });
      const updated = await tx.user.update({
        where: { id: user.id },
        data: {
          points: { increment: pointsEarned },
          totalSpending: { increment: amount },
        },
        select: { points: true, totalSpending: true },
      });
      const totalSpending = Number(updated.totalSpending);
      await tx.user.update({
        where: { id: user.id },
        data: { loyaltyLevel: computeTier(totalSpending) },
      });
      await tx.user.updateMany({
        where: {
          id: user.id,
          OR: [{ lastTransactionAt: null }, { lastTransactionAt: { lt: spendingDate } }],
        },
        data: { lastTransactionAt: spendingDate },
      });
      return updated;
    });
    const totalSpending = Number(updatedUser.totalSpending);
    const tier = computeTier(totalSpending);

    return NextResponse.json({
      success: true,
      message: 'Spending berhasil dicatat.',
      totalSpending,
      tier,
      pointsEarned,
      points: updatedUser.points,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('Error recording spending:', error);
    return NextResponse.json({ error: 'Gagal mencatat spending' }, { status: 500 });
  }
}
