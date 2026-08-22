import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';
import { requireAdmin, handleAuthError } from '@/lib/auth';

const TIER_THRESHOLDS = { SILVER: 1_000_000, GOLD: 5_000_000, PLATINUM: 10_000_000 };

function computeTier(totalSpending: number): 'Bronze' | 'Silver' | 'Gold' | 'Platinum' {
  if (totalSpending >= TIER_THRESHOLDS.PLATINUM) return 'Platinum';
  if (totalSpending >= TIER_THRESHOLDS.GOLD) return 'Gold';
  if (totalSpending >= TIER_THRESHOLDS.SILVER) return 'Silver';
  return 'Bronze';
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
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
        },
      });
    }

    if (!user) {
      return NextResponse.json({
        error: phone ? 'Member dengan nomor HP ini tidak ditemukan' : 'QR token tidak valid'
      }, { status: 404 });
    }

    const totalSpending = Number(user.totalSpending);

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
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[MEMBER-LOOKUP] Error:', error);
    return NextResponse.json({ error: 'Gagal mencari member' }, { status: 500 });
  }
}
