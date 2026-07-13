import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';

const TIER_THRESHOLDS = { GOLD: 1_000_000, PLATINUM: 5_000_000 };

function computeTier(totalSpending: number): 'SILVER' | 'GOLD' | 'PLATINUM' {
  if (totalSpending >= TIER_THRESHOLDS.PLATINUM) return 'PLATINUM';
  if (totalSpending >= TIER_THRESHOLDS.GOLD) return 'GOLD';
  return 'SILVER';
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Token wajib diisi' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { qrToken: token },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        reservations: {
          where: { status: 'completed' },
          select: { finalPrice: true },
        },
        spendingRecords: {
          select: { amount: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Member tidak ditemukan. QR tidak valid.' }, { status: 404 });
    }

    const reservationSpending = user.reservations.reduce((sum, r) => sum + Number(r.finalPrice), 0);
    const scanSpending = user.spendingRecords.reduce((sum, s) => sum + Number(s.amount), 0);
    const totalSpending = reservationSpending + scanSpending;

    return NextResponse.json({
      member: {
        id: user.id,
        name: [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Member',
        email: user.email,
        phone: normalizePhone(user.phone || '-'),
        totalSpending,
        tier: computeTier(totalSpending),
      },
    });
  } catch (error) {
    console.error('Error looking up member:', error);
    return NextResponse.json({ error: 'Gagal mencari member' }, { status: 500 });
  }
}
