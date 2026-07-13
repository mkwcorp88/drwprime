import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateCommission, calculateLoyaltyPoints } from '@/lib/affiliate';
import { sendReservationToAdminWhatsApp } from '@/lib/whatsapp';
import { normalizePhone } from '@/lib/phone';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    const body = await req.json();
    const treatmentId = body.treatmentId;
    const patientName = body.patientName;
    const patientEmail = body.patientEmail ?? body.email;
    const patientPhone = normalizePhone(body.patientPhone ?? body.phone);
    const patientNotes = body.patientNotes ?? body.notes;
    const reservationDate = body.reservationDate ?? body.preferredDate;
    const reservationTime = body.reservationTime ?? body.preferredTime;
    const referredBy = body.referredBy ?? body.referralCode ?? body.affiliateCode;

    if (!treatmentId || !patientName || !patientEmail || !patientPhone || !reservationDate || !reservationTime) {
      return NextResponse.json(
        { error: 'Data reservasi belum lengkap' },
        { status: 400 }
      );
    }

    const parsedReservationDate = new Date(reservationDate);
    if (Number.isNaN(parsedReservationDate.getTime())) {
      return NextResponse.json(
        { error: 'Tanggal reservasi tidak valid' },
        { status: 400 }
      );
    }

    // Get treatment details
    const treatment = await prisma.treatment.findUnique({
      where: { id: treatmentId }
    });

    if (!treatment) {
      return NextResponse.json({ error: 'Treatment not found' }, { status: 404 });
    }

    let user = null;
    let referrer = null;
    let commissionAmount = 0;

    // If user is logged in, get their data
    if (userId) {
      user = await prisma.user.findUnique({
        where: { clerkUserId: userId }
      });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Validate: cannot use own affiliate code
      if (referredBy && referredBy === user.affiliateCode) {
        return NextResponse.json(
          { error: 'Tidak dapat menggunakan kode affiliate sendiri' },
          { status: 400 }
        );
      }
    }

    // Check if there's a referrer (for both logged-in and guest users)
    if (referredBy) {
      // Find referrer by affiliate code
      referrer = await prisma.user.findFirst({
        where: { affiliateCode: referredBy.toUpperCase() }
      });

      // Allow unclaimed codes - no validation error if referrer not found
      // Commission will be tracked and can be claimed later
      if (referrer) {
        commissionAmount = calculateCommission(Number(treatment.price));
        console.log(`[AFFILIATE] Referral tracked: ${referredBy} -> Commission: ${commissionAmount}`);
      } else {
        // Code not claimed yet, but still track it
        commissionAmount = calculateCommission(Number(treatment.price));
        console.log(`[AFFILIATE] Unclaimed code used: ${referredBy} -> Commission pending: ${commissionAmount}`);
      }
    }

    // Create reservation (with or without userId)
    const reservation = await prisma.reservation.create({
      data: {
        userId: user?.id || null, // null for guest users
        treatmentId: treatment.id,
        referredBy: referredBy || null,
        referrerId: referrer?.id || null,
        patientName,
        patientEmail,
        patientPhone,
        patientNotes: patientNotes || null,
        reservationDate: parsedReservationDate,
        reservationTime,
        originalPrice: treatment.price,
        finalPrice: treatment.price,
        commissionAmount: commissionAmount
      }
    });

    try {
      await sendReservationToAdminWhatsApp({
        reservationId: reservation.id,
        treatmentName: treatment.name,
        treatmentPrice: Number(treatment.price),
        patientName,
        patientEmail,
        patientPhone,
        reservationDate: parsedReservationDate,
        reservationTime,
        patientNotes: patientNotes || null,
        referredBy: referredBy || null,
      });
    } catch (whatsAppError) {
      console.error('[WHATSAPP] Failed to send reservation notification:', whatsAppError);
    }

    // Only add loyalty points and transaction if user is logged in
    if (user) {
      const loyaltyPoints = calculateLoyaltyPoints(Number(treatment.price));
      await prisma.user.update({
        where: { id: user.id },
        data: {
          loyaltyPoints: { increment: loyaltyPoints }
        }
      });

      // Create transaction record
      await prisma.transaction.create({
        data: {
          userId: user.id,
          type: 'points_earned',
          amount: treatment.price,
          points: loyaltyPoints,
          description: `Earned ${loyaltyPoints} loyalty points from reservation`,
          referenceId: reservation.id
        }
      });
    }

    return NextResponse.json({ reservation });
  } catch (error) {
    console.error('Error creating reservation:', error);
    return NextResponse.json(
      { error: 'Failed to create reservation' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const reservations = await prisma.reservation.findMany({
      where: { userId: user.id },
      include: {
        treatment: {
          include: {
            category: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
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
