import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = req.nextUrl;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Fetch both sources in parallel
    const [medicalRecords, spendingRecords] = await Promise.all([
      // AIDO medical records
      prisma.riwayatTindakan.findMany({
        where: { userId },
        orderBy: { tanggalKunjungan: 'desc' },
        take: 50,
      }),
      // Sales report spending records
      prisma.spendingRecord.findMany({
        where: { userId },
        orderBy: { spendingDate: 'desc' },
        take: 50,
      }),
    ]);

    // Get user's total spending and points for summary
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { totalSpending: true, points: true },
    });

    // Merge into unified timeline
    const timeline: {
      date: string;
      type: 'tindakan' | 'spending';
      description: string;
      amount?: number;
    }[] = [];

    for (const r of medicalRecords) {
      timeline.push({
        date: r.tanggalKunjungan.toISOString(),
        type: 'tindakan',
        description: r.deskripsiTindakan || 'Tindakan medis',
      });
    }

    for (const s of spendingRecords) {
      timeline.push({
        date: s.spendingDate.toISOString(),
        type: 'spending',
        description: s.treatment || 'Transaksi',
        amount: Number(s.amount),
      });
    }

    // Sort by date descending
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      success: true,
      timeline: timeline.slice(0, 50),
      medicalCount: medicalRecords.length,
      spendingCount: spendingRecords.length,
      totalSpending: user ? Number(user.totalSpending) : 0,
      points: user?.points ?? 0,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[RIWAYAT-TINDAKAN] Error:', error);
    return NextResponse.json({ error: 'Gagal memuat riwayat tindakan' }, { status: 500 });
  }
}
