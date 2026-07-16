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
    const phone = req.nextUrl.searchParams.get('phone');

    if (!token && !phone) {
      return NextResponse.json({ error: 'Token QR atau nomor HP wajib diisi' }, { status: 400 });
    }

    let user;
    if (phone) {
      user = await prisma.user.findUnique({
        where: { phone: phone.trim() },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          hasAccount: true,
          points: true,
          totalSpending: true,
          reservations: {
            where: { status: 'completed' },
            select: { finalPrice: true },
          },
          spendingRecords: {
            select: { amount: true },
          },
        },
      });
    } else if (token) {
      user = await prisma.user.findUnique({
        where: { qrToken: token.trim() },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          hasAccount: true,
          points: true,
          totalSpending: true,
          reservations: {
            where: { status: 'completed' },
            select: { finalPrice: true },
          },
          spendingRecords: {
            select: { amount: true },
          },
        },
      });
    }

    if (!user) {
      return NextResponse.json({
        error: phone ? 'Member dengan nomor HP ini tidak ditemukan' : 'QR token tidak valid'
      }, { status: 404 });
    }

    const reservationSpending = user.reservations.reduce((sum, r) => sum + Number(r.finalPrice), 0);
    const scanSpending = user.spendingRecords.reduce((sum, s) => sum + Number(s.amount), 0);
    const totalSpending = reservationSpending + scanSpending;

    return NextResponse.json({
      member: {
        id: user.id,
        name: [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Member',
        email: user.email || null,
        phone: normalizePhone(user.phone || '-'),
        points: user.points,
        totalSpending: Number(user.totalSpending),
        hasAccount: user.hasAccount,
        tier: computeTier(totalSpending),
      },
    });
  } catch (error) {
    console.error('[MEMBER-LOOKUP] Error:', error);
    return NextResponse.json({ error: 'Gagal mencari member' }, { status: 500 });
  }
}
