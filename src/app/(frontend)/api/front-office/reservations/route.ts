import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Front Office endpoint - no auth required
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';
    const date = searchParams.get('date');

    const whereClause: Record<string, unknown> = {};

    if (status !== 'all') {
      whereClause.status = status;
    }

    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);

      whereClause.reservationDate = {
        gte: startDate,
        lt: endDate
      };
    }

    const reservations = await prisma.reservation.findMany({
      where: whereClause,
      include: {
        treatment: {
          include: {
            category: true
          }
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            affiliateCode: true
          }
        },
        referrer: {
          select: {
            firstName: true,
            lastName: true,
            affiliateCode: true
          }
        }
      },
      orderBy: [
        { reservationDate: 'asc' },
        { reservationTime: 'asc' }
      ]
    });

    return NextResponse.json({ reservations });
  } catch (error) {
    console.error('Error fetching reservations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reservations' },
      { status: 500 }
    );
  }
}

const RUPIAH_PER_POINT = 10000; // Rp 10.000 = 1 poin

function getLoyaltyLevel(totalPoints: number): string {
  if (totalPoints >= 10000) return 'Platinum';
  if (totalPoints >= 5000) return 'Gold';
  if (totalPoints >= 1000) return 'Silver';
  return 'Bronze';
}

async function awardMemberPoints(reservationId: string, userId: string, finalPrice: number) {
  const pointsEarned = Math.floor(finalPrice / RUPIAH_PER_POINT);
  if (pointsEarned <= 0) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { loyaltyPoints: true, points: true }
  });
  if (!user) return;

  const newLoyaltyPoints = user.loyaltyPoints + pointsEarned;

  await prisma.user.update({
    where: { id: userId },
    data: {
      points: { increment: pointsEarned },
      loyaltyPoints: { increment: pointsEarned },
      loyaltyLevel: getLoyaltyLevel(newLoyaltyPoints)
    }
  });

  await prisma.transaction.create({
    data: {
      userId,
      type: 'points_earned',
      amount: 0,
      points: pointsEarned,
      description: `Poin dari reservasi terkonfirmasi (${pointsEarned} poin)`,
      referenceId: reservationId
    }
  });

  console.log(`[POINTS] Awarded ${pointsEarned} points to user ${userId} for reservation ${reservationId}`);
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { reservationId, status, adminNotes, finalPrice } = body;

    const prevReservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { status: true, userId: true, finalPrice: true, referrerId: true, commissionPaid: true, commissionAmount: true, patientName: true }
    });

    if (!prevReservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    const wasConfirmed = prevReservation.status === 'confirmed';
    const wasCompleted = prevReservation.status === 'completed';

    // Calculate commission based on finalPrice if provided
    const updateData: Record<string, unknown> = {
      status,
      adminNotes: adminNotes || null,
      completedAt: status === 'completed' ? new Date() : null
    };

    // If finalPrice provided, update it and recalculate commission
    if (finalPrice !== undefined) {
      const commissionRate = 0.10; // 10%
      updateData.finalPrice = finalPrice;
      updateData.commissionAmount = finalPrice * commissionRate;
    }

    const reservation = await prisma.reservation.update({
      where: { id: reservationId },
      data: updateData
    });

    // Award loyalty points to member when confirmed for the first time
    if (status === 'confirmed' && !wasConfirmed && !wasCompleted && reservation.userId) {
      const effectivePrice = finalPrice !== undefined ? finalPrice : Number(prevReservation.finalPrice);
      await awardMemberPoints(reservationId, reservation.userId, effectivePrice);
    }

    // If completed and has referrer, pay commission
    if (status === 'completed' && reservation.referrerId && !reservation.commissionPaid) {
      const commissionAmount = reservation.commissionAmount;

      console.log(`[COMMISSION] Paying commission for reservation ${reservationId}`);
      console.log(`[COMMISSION] Referrer ID: ${reservation.referrerId}`);
      console.log(`[COMMISSION] Amount: ${commissionAmount}`);

      // Update referrer earnings
      await prisma.user.update({
        where: { id: reservation.referrerId },
        data: {
          totalEarnings: { increment: commissionAmount },
          totalReferrals: { increment: 1 },
          points: { increment: Math.floor(Number(commissionAmount) / 100) }
        }
      });

      // Create commission transaction
      await prisma.transaction.create({
        data: {
          userId: reservation.referrerId,
          type: 'commission',
          amount: commissionAmount,
          points: Math.floor(Number(commissionAmount) / 100),
          description: `Commission from referral: ${reservation.patientName}`,
          referenceId: reservation.id
        }
      });

      // Mark commission as paid
      await prisma.reservation.update({
        where: { id: reservationId },
        data: { commissionPaid: true }
      });

      console.log(`[COMMISSION] Successfully paid commission to referrer`);
    }

    return NextResponse.json({ reservation });
  } catch (error) {
    console.error('Error updating reservation:', error);
    return NextResponse.json(
      { error: 'Failed to update reservation' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { reservationId, affiliateCode, action } = body;

    if (action !== 'addAffiliate') {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    if (!affiliateCode || !reservationId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Find user by affiliate code
    const referrer = await prisma.user.findFirst({
      where: { affiliateCode: affiliateCode.toUpperCase() }
    });

    if (!referrer) {
      console.log(`[AFFILIATE] Code not found: ${affiliateCode}`);
      return NextResponse.json(
        { error: 'Kode affiliate tidak ditemukan' },
        { status: 404 }
      );
    }

    console.log(`[AFFILIATE] Adding referrer: ${referrer.firstName} ${referrer.lastName} (${affiliateCode})`);

    // Get current reservation
    const currentReservation = await prisma.reservation.findUnique({
      where: { id: reservationId }
    });

    if (!currentReservation) {
      return NextResponse.json(
        { error: 'Reservasi tidak ditemukan' },
        { status: 404 }
      );
    }

    // Check if user trying to use their own affiliate code
    if (currentReservation.userId === referrer.id) {
      console.log(`[AFFILIATE] Self-referral blocked for user ${referrer.id}`);
      return NextResponse.json(
        { error: 'Tidak bisa menggunakan kode affiliate sendiri' },
        { status: 400 }
      );
    }

    // Calculate commission
    const commissionRate = 0.10; // 10%
    const commissionAmount = Number(currentReservation.finalPrice) * commissionRate;

    console.log(`[AFFILIATE] Commission calculated: Rp ${commissionAmount} for reservation ${reservationId}`);

    // Update reservation with referrer
    const reservation = await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        referredBy: affiliateCode.toUpperCase(),
        referrerId: referrer.id,
        commissionAmount
      },
      include: {
        treatment: {
          include: {
            category: true
          }
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            affiliateCode: true
          }
        },
        referrer: {
          select: {
            firstName: true,
            lastName: true,
            affiliateCode: true
          }
        }
      }
    });

    // If reservation already completed, pay commission immediately
    if (reservation.status === 'completed' && !reservation.commissionPaid) {
      console.log(`[COMMISSION] Reservation already completed, paying commission now...`);
      
      await prisma.user.update({
        where: { id: referrer.id },
        data: {
          totalEarnings: { increment: commissionAmount },
          totalReferrals: { increment: 1 },
          points: { increment: Math.floor(commissionAmount / 100) }
        }
      });

      await prisma.transaction.create({
        data: {
          userId: referrer.id,
          type: 'commission',
          amount: commissionAmount,
          points: Math.floor(commissionAmount / 100),
          description: `Commission from referral: ${reservation.patientName}`,
          referenceId: reservation.id
        }
      });

      await prisma.reservation.update({
        where: { id: reservationId },
        data: { commissionPaid: true }
      });

      console.log(`[COMMISSION] Successfully paid Rp ${commissionAmount} to ${referrer.firstName} ${referrer.lastName}`);
    }

    return NextResponse.json({ reservation, message: 'Affiliate berhasil ditambahkan' });
  } catch (error) {
    console.error('Error adding affiliate:', error);
    return NextResponse.json(
      { error: 'Failed to add affiliate' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      reservationId, 
      patientName,
      patientEmail,
      patientPhone,
      reservationDate,
      reservationTime,
      treatmentId,
      finalPrice,
      status,
      adminNotes,
      patientNotes,
      affiliateCode
    } = body;

    if (!reservationId) {
      return NextResponse.json(
        { error: 'Reservation ID required' },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (patientName !== undefined) updateData.patientName = patientName;
    if (patientEmail !== undefined) updateData.patientEmail = patientEmail;
    if (patientPhone !== undefined) updateData.patientPhone = patientPhone;
    if (reservationDate !== undefined) updateData.reservationDate = new Date(reservationDate);
    if (reservationTime !== undefined) updateData.reservationTime = reservationTime;
    if (treatmentId !== undefined) updateData.treatmentId = treatmentId;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'completed') {
        updateData.completedAt = new Date();
      }
    }
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
    if (patientNotes !== undefined) updateData.patientNotes = patientNotes;

    // Handle finalPrice and commission
    if (finalPrice !== undefined) {
      const commissionRate = 0.10; // 10%
      updateData.finalPrice = finalPrice;
      updateData.commissionAmount = finalPrice * commissionRate;
    }

    // Fetch current reservation to know previous status
    const currentReservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { status: true, userId: true, finalPrice: true }
    });

    if (!currentReservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    const wasConfirmed = currentReservation.status === 'confirmed';
    const wasCompleted = currentReservation.status === 'completed';

    // Handle affiliate code change
    if (affiliateCode !== undefined && affiliateCode !== null && affiliateCode !== '') {
      const referrer = await prisma.user.findFirst({
        where: { affiliateCode: affiliateCode.toUpperCase() }
      });

      if (referrer) {
        updateData.referredBy = affiliateCode.toUpperCase();
        updateData.referrerId = referrer.id;
        
        const price = finalPrice !== undefined ? finalPrice : currentReservation.finalPrice;
        updateData.commissionAmount = Number(price) * 0.10;
      }
    }

    // Update reservation
    const reservation = await prisma.reservation.update({
      where: { id: reservationId },
      data: updateData,
      include: {
        treatment: {
          include: {
            category: true
          }
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            affiliateCode: true
          }
        },
        referrer: {
          select: {
            firstName: true,
            lastName: true,
            affiliateCode: true
          }
        }
      }
    });

    // Award loyalty points when confirmed for the first time
    if (status === 'confirmed' && !wasConfirmed && !wasCompleted && reservation.userId) {
      const effectivePrice = finalPrice !== undefined ? finalPrice : Number(currentReservation.finalPrice);
      await awardMemberPoints(reservationId, reservation.userId, effectivePrice);
    }

    return NextResponse.json({ 
      reservation, 
      message: 'Reservation updated successfully' 
    });
  } catch (error) {
    console.error('Error updating reservation:', error);
    return NextResponse.json(
      { error: 'Failed to update reservation' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const reservationId = searchParams.get('id');

    if (!reservationId) {
      return NextResponse.json(
        { error: 'Reservation ID required' },
        { status: 400 }
      );
    }

    // Check if reservation exists
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId }
    });

    if (!reservation) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      );
    }

    // Delete the reservation
    await prisma.reservation.delete({
      where: { id: reservationId }
    });

    return NextResponse.json({ 
      message: 'Reservation deleted successfully',
      deletedId: reservationId
    });
  } catch (error) {
    console.error('Error deleting reservation:', error);
    return NextResponse.json(
      { error: 'Failed to delete reservation' },
      { status: 500 }
    );
  }
}
