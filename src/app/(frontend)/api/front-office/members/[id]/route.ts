import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';
import { computeMemberTierFromSpending } from '@/lib/policies/loyalty';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();

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
    const tier = computeMemberTierFromSpending(Number(member.totalSpending));

    return NextResponse.json({
      success: true,
      member: {
        ...member,
        tier,
        fullName: [member.firstName, member.lastName].filter(Boolean).join(' '),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[MEMBER-DETAIL] Error:', error);
    return NextResponse.json({ error: 'Gagal memuat detail member' }, { status: 500 });
  }
}
