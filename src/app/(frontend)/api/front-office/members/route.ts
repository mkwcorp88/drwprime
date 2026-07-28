import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isUserAdmin } from '@/lib/admin';
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
    if (!(await isUserAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      where.loyaltyLevel = tierFilter;
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
    const staleUpdates = membersWithDetails
      .filter(m => m.loyaltyLevel !== m.tier || m.loyaltyLevel !== m.loyaltyLevel) // filter actual mismatches
      .filter(m => {
        // Check if stored level differs from computed
        const stored = members.find(x => x.id === m.id);
        return stored && stored.loyaltyLevel !== m.tier;
      });
    
    if (staleUpdates.length > 0) {
      await Promise.all(
        staleUpdates.map(m =>
          prisma.user.update({
            where: { id: m.id },
            data: { loyaltyLevel: m.tier as any },
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
    console.error('[MEMBERS] Error fetching members:', error);
    return NextResponse.json({ error: 'Gagal memuat daftar member' }, { status: 500 });
  }
}
