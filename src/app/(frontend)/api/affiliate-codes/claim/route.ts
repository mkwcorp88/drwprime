import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { calculateCommission } from '@/lib/policies/commission';
import { payCommissionTx } from '@/lib/services/reservation';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const adminUser = await prisma.user.findUnique({
      where: { clerkUserId: userId }
    });

    if (!adminUser?.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const { codeId, email } = await request.json();

    if (!codeId || !email) {
      return NextResponse.json(
        { error: 'Code ID and email are required' },
        { status: 400 }
      );
    }

    // Check if code exists
    const code = await prisma.preClaimAffiliateCode.findUnique({
      where: { id: codeId }
    });

    if (!code) {
      return NextResponse.json(
        { error: 'Code not found' },
        { status: 404 }
      );
    }

    // Check if code is already claimed
    if (code.status === 'claimed') {
      return NextResponse.json(
        { error: 'Code is already claimed' },
        { status: 400 }
      );
    }

    // Find user by email
    const targetUser = await prisma.user.findFirst({
      where: { email: email }
    });

    if (!targetUser) {
      // User doesn't exist yet - just assign email and they'll claim on first login
      const updatedCode = await prisma.preClaimAffiliateCode.update({
        where: { id: codeId },
        data: {
          assignedEmail: email
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Email assigned. Code will be claimed when user logs in.',
        code: updatedCode
      });
    }

    const updatedCode = await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: targetUser.id }, data: { affiliateCode: code.code } });

      const reservations = await tx.reservation.findMany({ where: { referredBy: code.code, referrerId: null } });
      for (const reservation of reservations) {
        const commissionAmount = calculateCommission(Number(reservation.finalPrice));
        const assigned = await tx.reservation.updateMany({
          where: { id: reservation.id, referrerId: null, commissionPaid: false },
          data: { referrerId: targetUser.id, commissionAmount },
        });
        if (assigned.count !== 1) continue;
        const current = await tx.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
        if (current.status === 'completed') {
          await payCommissionTx(tx, reservation.id, targetUser.id, commissionAmount);
        }
      }

      return tx.preClaimAffiliateCode.update({
        where: { id: codeId },
        data: { status: 'claimed', claimedBy: targetUser.id, claimedAt: new Date(), assignedEmail: email },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Code successfully claimed',
      code: updatedCode
    });

  } catch (error) {
    console.error('Error claiming code:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
