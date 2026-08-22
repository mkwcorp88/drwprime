import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';
import { Prisma } from '@prisma/client';

const TIER_THRESHOLDS = { Silver: 1_000_000, Gold: 5_000_000, Platinum: 10_000_000 };

function computeTier(totalSpending: number): 'Bronze' | 'Silver' | 'Gold' | 'Platinum' {
  if (totalSpending >= TIER_THRESHOLDS.Platinum) return 'Platinum';
  if (totalSpending >= TIER_THRESHOLDS.Gold) return 'Gold';
  if (totalSpending >= TIER_THRESHOLDS.Silver) return 'Silver';
  return 'Bronze';
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = req.nextUrl;
    const search = searchParams.get('search');
    const filterType = searchParams.get('filter');
    const tierFilter = searchParams.get('tier');
    const sortBy = searchParams.get('sort') || 'rm';

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;

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

    if (tierFilter && ['Bronze', 'Silver', 'Gold', 'Platinum'].includes(tierFilter)) {
      if (tierFilter === 'Bronze') where.totalSpending = { lt: TIER_THRESHOLDS.Silver };
      if (tierFilter === 'Silver') {
        where.totalSpending = { gte: TIER_THRESHOLDS.Silver, lt: TIER_THRESHOLDS.Gold };
      }
      if (tierFilter === 'Gold') {
        where.totalSpending = { gte: TIER_THRESHOLDS.Gold, lt: TIER_THRESHOLDS.Platinum };
      }
      if (tierFilter === 'Platinum') where.totalSpending = { gte: TIER_THRESHOLDS.Platinum };
    }

    const orderBy: Prisma.UserOrderByWithRelationInput = {};
    if (sortBy === 'totalSpending') {
      orderBy.totalSpending = 'desc';
    } else if (sortBy === 'points') {
      orderBy.points = 'desc';
    } else if (sortBy === 'rm') {
      orderBy.nomorRekamMedis = 'asc';
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
        nomorRekamMedis: true,
        // Tambahan untuk detail modal
        nik: true,
        gender: true,
        dateOfBirth: true,
        address: true,
        city: true,
        province: true,
        postalCode: true,
        profileCompletedAt: true,
        loyaltyPoints: true,
        loyaltyLevel: true,
        totalEarnings: true,
        totalReferrals: true,
        affiliateCode: true,
      },
      orderBy,
      // take: 200, // limit untuk performance - Dihapus untuk menampilkan semua
      take: limit,
      skip: skip,
    });

    const totalMembers = await prisma.user.count({ where });

    // Ambil aktivitas terakhir untuk setiap member
    const memberIds = members.map(m => m.id);

    const lastTransactions = await prisma.transaction.findMany({
      where: { userId: { in: memberIds } },
      orderBy: { createdAt: 'desc' },
      distinct: ['userId'],
      select: { userId: true, description: true, createdAt: true },
    });

    const lastReservations = await prisma.reservation.findMany({
      where: { userId: { in: memberIds } },
      orderBy: { reservationDate: 'desc' },
      distinct: ['userId'],
      select: { userId: true, treatment: { select: { name: true } }, status: true, reservationDate: true },
    });

    const lastTxMap = new Map(lastTransactions.map(t => [t.userId, t]));
    const lastResMap = new Map(lastReservations.map(r => [r.userId, r]));


    // Compute tier & auto-sync loyalty level
    const membersWithDetails = members.map(m => {
      const computedTier = computeTier(Number(m.totalSpending));
      const lastTx = lastTxMap.get(m.id);
      const lastRes = lastResMap.get(m.id);
      return {
      ...m,
      loyaltyLevel: computedTier, // overwrite with computed tier as source of truth
      tier: computedTier,
      fullName: [m.firstName, m.lastName].filter(Boolean).join(' '),
      lastTransaction: lastTx ? { date: lastTx.createdAt.toISOString(), description: lastTx.description } : null,
      lastReservation: lastRes ? { date: lastRes.reservationDate.toISOString(), treatment: lastRes.treatment.name, status: lastRes.status } : null,
    }});

    // Auto-sync DB: update any stale loyalty_level
    const staleUpdates = members.filter(
      (member) => member.loyaltyLevel !== computeTier(Number(member.totalSpending))
    );
    
    if (staleUpdates.length > 0) {
      await Promise.all(
        staleUpdates.map((member) =>
          prisma.user.update({
            where: { id: member.id },
            data: { loyaltyLevel: computeTier(Number(member.totalSpending)) },
          })
        )
      );
    }

    return NextResponse.json({ 
      success: true, 
      members: membersWithDetails, 
      total: totalMembers,
      page,
      limit,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[MEMBERS] Error fetching members:', error);
    return NextResponse.json({ error: 'Gagal memuat daftar member' }, { status: 500 });
  }
}
