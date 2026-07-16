import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

// GET - Aggregate stats for the marketing dashboard overview
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [total, byStatus, byType, byPriority, overdue, avgProgress] = await Promise.all([
      prisma.marketingAssignment.count(),
      prisma.marketingAssignment.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.marketingAssignment.groupBy({ by: ['type'], _count: { _all: true } }),
      prisma.marketingAssignment.groupBy({ by: ['priority'], _count: { _all: true } }),
      prisma.marketingAssignment.count({
        where: {
          dueDate: { lt: new Date() },
          status: { notIn: ['done', 'cancelled'] },
        },
      }),
      prisma.marketingAssignment.aggregate({
        _avg: { progress: true },
        where: { status: { notIn: ['cancelled'] } },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    byStatus.forEach((s) => (statusCounts[s.status] = s._count._all));

    const typeCounts: Record<string, number> = {};
    byType.forEach((t) => (typeCounts[t.type] = t._count._all));

    const priorityCounts: Record<string, number> = {};
    byPriority.forEach((p) => (priorityCounts[p.priority] = p._count._all));

    return NextResponse.json({
      success: true,
      stats: {
        total,
        statusCounts,
        typeCounts,
        priorityCounts,
        overdue,
        avgProgress: Math.round(avgProgress._avg.progress ?? 0),
      },
    });
  } catch (error) {
    console.error('[MARKETING] Error building stats:', error);
    return NextResponse.json({ error: 'Gagal memuat statistik' }, { status: 500 });
  }
}
