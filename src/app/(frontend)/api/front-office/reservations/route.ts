import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';
import { normalizePhone } from '@/lib/phone';
import {
  confirmReservation,
  completeReservation,
  cancelReservation,
  addReferrer,
  ReservationError,
} from '@/lib/services/reservation';
import { calculateCommission } from '@/lib/policies/commission';

export async function GET(req: Request) {
  try {
    await requireAdmin();

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
      whereClause.reservationDate = { gte: startDate, lt: endDate };
    }

    const reservations = await prisma.reservation.findMany({
      where: whereClause,
      include: {
        treatment: { include: { category: true } },
        user: { select: { firstName: true, lastName: true, email: true, affiliateCode: true } },
        referrer: { select: { firstName: true, lastName: true, affiliateCode: true } },
      },
      orderBy: [{ reservationDate: 'asc' }, { reservationTime: 'asc' }],
    });

    const normalizedReservations = reservations.map((r) => ({
      ...r,
      patientPhone: normalizePhone(r.patientPhone),
    }));

    return NextResponse.json({ reservations: normalizedReservations });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { reservationId, status, adminNotes, finalPrice } = body;

    if (status === 'confirmed') {
      await confirmReservation(reservationId);
      return NextResponse.json({ success: true });
    }

    if (status === 'completed') {
      await completeReservation(reservationId, { finalPrice, adminNotes });
      return NextResponse.json({ success: true });
    }

    if (status === 'cancelled') {
      await cancelReservation(reservationId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  } catch (error) {
    if (error instanceof ReservationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleAuthError(error);
  }
}

export async function PUT(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { reservationId, affiliateCode, action } = body;

    if (action !== 'addAffiliate') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (!affiliateCode || !reservationId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await addReferrer(reservationId, affiliateCode);

    return NextResponse.json({ message: 'Affiliate berhasil ditambahkan' });
  } catch (error) {
    if (error instanceof ReservationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleAuthError(error);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();

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
      affiliateCode,
    } = body;

    if (!reservationId) {
      return NextResponse.json({ error: 'Reservation ID required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};

    if (patientName !== undefined) updateData.patientName = patientName;
    if (patientEmail !== undefined) updateData.patientEmail = patientEmail;
    if (patientPhone !== undefined) updateData.patientPhone = normalizePhone(patientPhone);
    if (reservationDate !== undefined) updateData.reservationDate = new Date(reservationDate);
    if (reservationTime !== undefined) updateData.reservationTime = reservationTime;
    if (treatmentId !== undefined) updateData.treatmentId = treatmentId;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'completed') updateData.completedAt = new Date();
    }
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
    if (patientNotes !== undefined) updateData.patientNotes = patientNotes;

    if (finalPrice !== undefined) {
      updateData.finalPrice = finalPrice;
      updateData.commissionAmount = calculateCommission(finalPrice);
    }

    const currentReservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { status: true, userId: true, finalPrice: true },
    });

    if (!currentReservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    if (affiliateCode !== undefined && affiliateCode !== null && affiliateCode !== '') {
      const referrer = await prisma.user.findFirst({
        where: { affiliateCode: affiliateCode.toUpperCase() },
      });

      if (referrer) {
        updateData.referredBy = affiliateCode.toUpperCase();
        updateData.referrerId = referrer.id;
        const price = finalPrice !== undefined ? finalPrice : currentReservation.finalPrice;
        updateData.commissionAmount = calculateCommission(Number(price));
      }
    }

    const reservation = await prisma.reservation.update({
      where: { id: reservationId },
      data: updateData,
      include: {
        treatment: { include: { category: true } },
        user: { select: { firstName: true, lastName: true, email: true, affiliateCode: true } },
        referrer: { select: { firstName: true, lastName: true, affiliateCode: true } },
      },
    });

    return NextResponse.json({ reservation, message: 'Reservation updated successfully' });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const reservationId = searchParams.get('id');

    if (!reservationId) {
      return NextResponse.json({ error: 'Reservation ID required' }, { status: 400 });
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    await prisma.reservation.delete({ where: { id: reservationId } });

    return NextResponse.json({ message: 'Reservation deleted successfully', deletedId: reservationId });
  } catch (error) {
    return handleAuthError(error);
  }
}
