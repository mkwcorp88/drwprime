import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAdmin, handleAuthError } from '@/lib/auth';

const prisma = new PrismaClient();

export async function GET() {
  try {
    await requireAdmin();
    // Get all users who have claimed affiliate codes (have affiliateCode)
    const users = await prisma.user.findMany({
      where: {
        affiliateCode: {
          not: ""
        }
      },
      include: {
        referrals: {
          select: {
            id: true,
            status: true,
            commissionAmount: true
          }
        },
        withdrawals: {
          select: {
            id: true,
            amount: true,
            status: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Process data to get affiliator statistics
    const affiliators = users.map(user => {
      const totalCommission = user.referrals
        .filter(r => r.status === 'completed')
        .reduce((sum, r) => sum + Number(r.commissionAmount || 0), 0);
      
      const totalReservations = user.referrals.filter(r => r.status === 'completed').length;

      // Calculate total withdrawn (completed withdrawals only)
      const totalWithdrawn = user.withdrawals
        .filter(w => w.status === 'completed')
        .reduce((sum, w) => sum + Number(w.amount || 0), 0);
      
      // Calculate remaining commission
      const remainingCommission = user.totalEarnings;

      return {
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email,
        affiliateCode: user.affiliateCode,
        totalCommission,
        totalWithdrawn,
        remainingCommission,
        totalReservations,
        claimedAt: user.createdAt
      };
    });

    return NextResponse.json({
      success: true,
      affiliators,
      total: affiliators.length
    });

  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('Error fetching affiliators:', error);
    return NextResponse.json(
      { error: 'Failed to fetch affiliators' },
      { status: 500 }
    );
  }
}
