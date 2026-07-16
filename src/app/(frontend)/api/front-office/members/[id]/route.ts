import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isUserAdmin } from '@/lib/admin';

const TIER_THRESHOLDS = { GOLD: 1_000_000, PLATINUM: 5_000_000 };

function computeTier(totalSpending: number): 'SILVER' | 'GOLD' | 'PLATINUM' {
  if (totalSpending >= TIER_THRESHOLDS.PLATINUM) return 'PLATINUM';
  if (totalSpending >= TIER_THRESHOLDS.GOLD) return 'GOLD';
  return 'SILVER';
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isUserAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const member = await prisma.user.findUnique({
      where: { id },
      include: {
        spendingRecords: {
          orderBy: { spendingDate: 'desc' },
          take: 50, // 50 transaksi terakhir
          select: {
            id: true,
            amount: true,
            treatment: true,
            spendingDate: true,
            pointsEarned: true,
            source: true,
          },
        },
        reservations: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            patientName: true,
            treatmentId: true,
            reservationDate: true,
            status: true,
            finalPrice: true,
            createdAt: true,
          },
          include: {
            treatment: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: 'Member tidak ditemukan' }, { status: 404 });
    }

    // Hitung tier
    const tier = computeTier(Number(member.totalSpending));

    return NextResponse.json({
      success: true,
      member: {
        ...member,
        tier,
        fullName: [member.firstName, member.lastName].filter(Boolean).join(' '),
      },
    });
  } catch (error) {
    console.error('[MEMBER-DETAIL] Error:', error);
    return NextResponse.json({ error: 'Gagal memuat detail member' }, { status: 500 });
  }
}
