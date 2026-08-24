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

    const { codeId, newEmail } = await request.json();

    if (!codeId || !newEmail) {
      return NextResponse.json(
        { error: 'Code ID and new email are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
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

    // Check if code is claimed
    if (code.status !== 'claimed') {
      return NextResponse.json(
        { error: 'Code must be claimed before transfer' },
        { status: 400 }
      );
    }

    // Find current owner
    const currentOwner = await prisma.user.findFirst({
      where: { 
        affiliateCode: code.code
      }
    });

    // Find new owner by email
    const newOwner = await prisma.user.findFirst({
      where: { email: newEmail }
    });

    if (!newOwner) {
      // New owner doesn't exist yet - update assigned email and set to unclaimed
      // They'll claim it on first login
      const updatedCode = await prisma.preClaimAffiliateCode.update({
        where: { id: codeId },
        data: {
          assignedEmail: newEmail,
          status: 'unclaimed',
          claimedBy: null,
          claimedAt: null
        }
      });

      // Remove code from current owner if exists
      if (currentOwner) {
        await prisma.user.update({
          where: { id: currentOwner.id },
          data: {
            affiliateCode: `TEMP_${currentOwner.id.slice(0, 8)}`
          }
        });
      }

      // Preserve paid referral history; unpaid reservations follow the code.
      await prisma.reservation.updateMany({
        where: {
          referredBy: code.code,
          commissionPaid: false,
        },
        data: {
          referrerId: null
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Code transferred. New owner will claim on first login.',
        code: updatedCode
      });
    }

    // New owner exists - transfer immediately
    // Remove code from current owner
    if (currentOwner) {
      await prisma.user.update({
        where: { id: currentOwner.id },
        data: {
          affiliateCode: `TEMP_${currentOwner.id.slice(0, 8)}`
        }
      });
    }

    // Assign code to new owner
    await prisma.user.update({
      where: { id: newOwner.id },
      data: {
        affiliateCode: code.code
      }
    });

    await prisma.$transaction(async (tx) => {
      const unpaidReservations = await tx.reservation.findMany({
        where: { referredBy: code.code, commissionPaid: false },
      });
      for (const reservation of unpaidReservations) {
        const commissionAmount = calculateCommission(Number(reservation.finalPrice));
        const assigned = await tx.reservation.updateMany({
          where: { id: reservation.id, commissionPaid: false },
          data: { referrerId: newOwner.id, commissionAmount },
        });
        if (assigned.count !== 1) continue;
        const current = await tx.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
        if (current.status === 'completed') {
          await payCommissionTx(tx, reservation.id, newOwner.id, commissionAmount);
        }
      }
    });

    // Update PreClaimAffiliateCode
    const updatedCode = await prisma.preClaimAffiliateCode.update({
      where: { id: codeId },
      data: {
        assignedEmail: newEmail,
        claimedBy: newOwner.id,
        claimedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Code successfully transferred',
      code: updatedCode
    });

  } catch (error) {
    console.error('Error transferring code:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
