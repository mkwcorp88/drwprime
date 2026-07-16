import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isUserAdmin } from '@/lib/admin';
import { Prisma } from '@prisma/client';

const TIER_THRESHOLDS = { GOLD: 1_000_000, PLATINUM: 5_000_000 };

function computeTier(totalSpending: number): 'SILVER' | 'GOLD' | 'PLATINUM' {
  if (totalSpending >= TIER_THRESHOLDS.PLATINUM) return 'PLATINUM';
  if (totalSpending >= TIER_THRESHOLDS.GOLD) return 'GOLD';
  return 'SILVER';
}

export async function GET(req: NextRequest) {
  try {
    if (!(await isUserAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const search = searchParams.get('search'); // cari by nama/phone
    const filterType = searchParams.get('filter'); // 'all' | 'with_account' | 'walk_in'
    const sortBy = searchParams.get('sort') || 'lastTransactionAt'; // lastTransactionAt | totalSpending | points

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    if (filterType === 'with_account') {
      where.hasAccount = true;
    } else if (filterType === 'walk_in') {
      where.hasAccount = false;
    }

    const orderBy: Prisma.UserOrderByWithRelationInput = {};
    if (sortBy === 'totalSpending') {
      orderBy.totalSpending = 'desc';
    } else if (sortBy === 'points') {
      orderBy.points = 'desc';
    } else {
      orderBy.lastTransactionAt = 'desc';
    }

    const members = await prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        points: true,
        totalSpending: true,
        lastTransactionAt: true,
        hasAccount: true,
        memberSince: true,
      },
      orderBy,
      take: 200, // limit untuk performance
    });

    // Compute tier for each member
    const membersWithTier = members.map(m => ({
      ...m,
      tier: computeTier(Number(m.totalSpending)),
      fullName: [m.firstName, m.lastName].filter(Boolean).join(' '),
    }));

    return NextResponse.json({ success: true, members: membersWithTier });
  } catch (error) {
    console.error('[MEMBERS] Error fetching members:', error);
    return NextResponse.json({ error: 'Gagal memuat daftar member' }, { status: 500 });
  }
}
