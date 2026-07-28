import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

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
      const parsed = new Date(dateInput);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'Tanggal tidak valid' }, { status: 400 });
      }
      spendingDate = parsed;
    }

    const user = await prisma.user.findUnique({
      where: { qrToken: token },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Member tidak ditemukan. QR tidak valid.' }, { status: 404 });
    }

    const pointsEarned = Math.floor(amount / RUPIAH_PER_POINT);

    const [, updatedUser] = await prisma.$transaction([
      prisma.spendingRecord.create({
        data: {
          userId: user.id,
          amount,
          treatment: treatment || null,
          spendingDate,
          recordedByClerkId: userId ?? null,
          source: 'scan',
          pointsEarned,
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { points: { increment: pointsEarned } },
        select: { points: true },
      }),
    ]);

    // Hitung ulang total spending member
    const [reservations, spendingRecords] = await Promise.all([
      prisma.reservation.findMany({
        where: { userId: user.id, status: 'completed' },
        select: { finalPrice: true },
      }),
      prisma.spendingRecord.findMany({
        where: { userId: user.id },
        select: { amount: true },
      }),
    ]);

    const totalSpending =
      reservations.reduce((sum, r) => sum + Number(r.finalPrice), 0) +
      spendingRecords.reduce((sum, s) => sum + Number(s.amount), 0);

    return NextResponse.json({
      success: true,
      message: 'Spending berhasil dicatat.',
      totalSpending,
      tier: computeTier(totalSpending),
      pointsEarned,
      points: updatedUser.points,
    });
  } catch (error) {
    console.error('Error recording spending:', error);
    return NextResponse.json({ error: 'Gagal mencatat spending' }, { status: 500 });
  }
}
