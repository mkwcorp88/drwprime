import { prisma } from '@/lib/prisma';
import { calculateCommission } from '@/lib/policies/commission';
import { calculateSpendingPoints, getLoyaltyTier } from '@/lib/policies/loyalty';

/**
 * Reservation state machine — ALL mutation must go through this module.
 *
 * Status transitions:
 *   pending  -> confirmed | cancelled
 *   confirmed -> completed | cancelled
 *   completed -> (terminal)
 *   cancelled -> (terminal)
 */

type ReservationStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

const VALID_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export class ReservationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ReservationError';
  }
}

export async function confirmReservation(reservationId: string) {
  return transitionStatus(reservationId, 'confirmed');
}

export async function completeReservation(
  reservationId: string,
  options: { finalPrice?: number; adminNotes?: string } = {},
) {
  const reservation = await transitionStatus(reservationId, 'completed');

  const finalPrice = options.finalPrice !== undefined
    ? options.finalPrice
    : Number(reservation.finalPrice);

  // Recalculate commission based on final price
  const commissionAmount = calculateCommission(finalPrice);

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id: reservationId },
      data: {
        completedAt: new Date(),
        finalPrice,
        commissionAmount,
        adminNotes: options.adminNotes ?? null,
      },
    });

    // Award spending points to the user
    if (reservation.userId) {
      const pointsEarned = calculateSpendingPoints(finalPrice);
      if (pointsEarned > 0) {
        const user = await tx.user.findUnique({
          where: { id: reservation.userId },
          select: { points: true, loyaltyPoints: true },
        });

        if (user) {
          const newLoyaltyPoints = user.loyaltyPoints + pointsEarned;
          await tx.user.update({
            where: { id: reservation.userId },
            data: {
              points: { increment: pointsEarned },
              totalSpending: { increment: finalPrice },
              loyaltyPoints: { increment: pointsEarned },
              loyaltyLevel: getLoyaltyTier(newLoyaltyPoints),
              lastTransactionAt: new Date(),
            },
          });

          await tx.transaction.create({
            data: {
              userId: reservation.userId,
              type: 'points_earned',
              amount: finalPrice,
              points: pointsEarned,
              description: `Poin dari reservasi selesai (${pointsEarned} poin)`,
              referenceId: reservationId,
            },
          });
        }
      }
    }

    // Pay commission to referrer
    if (reservation.referrerId && commissionAmount > 0) {
      await payCommissionTx(tx, reservationId, reservation.referrerId, commissionAmount);
    }
  });

  return reservation;
}

export async function cancelReservation(reservationId: string) {
  return transitionStatus(reservationId, 'cancelled');
}

export async function addReferrer(
  reservationId: string,
  affiliateCode: string,
) {
  const code = affiliateCode.toUpperCase();

  const referrer = await prisma.user.findFirst({
    where: { affiliateCode: code },
  });

  if (!referrer) {
    throw new ReservationError('Kode affiliate tidak ditemukan', 'NOT_FOUND');
  }

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { userId: true, status: true, finalPrice: true, commissionPaid: true },
  });

  if (!reservation) {
    throw new ReservationError('Reservasi tidak ditemukan', 'NOT_FOUND');
  }

  if (reservation.userId === referrer.id) {
    throw new ReservationError(
      'Tidak bisa menggunakan kode affiliate sendiri',
      'SELF_REFERRAL',
    );
  }

  const commissionAmount = calculateCommission(Number(reservation.finalPrice));

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id: reservationId },
      data: {
        referredBy: code,
        referrerId: referrer.id,
        commissionAmount,
      },
    });

    if (reservation.status === 'completed' && !reservation.commissionPaid) {
      await payCommissionTx(tx, reservationId, referrer.id, commissionAmount);
    }
  });

  return { referrerId: referrer.id, commissionAmount };
}

// --- Internal helpers ---

async function transitionStatus(
  reservationId: string,
  targetStatus: ReservationStatus,
) {
  const current = await prisma.reservation.findUnique({
    where: { id: reservationId },
  });

  if (!current) {
    throw new ReservationError('Reservation not found', 'NOT_FOUND');
  }

  const allowed = VALID_TRANSITIONS[current.status as ReservationStatus];
  if (!allowed || !allowed.includes(targetStatus)) {
    throw new ReservationError(
      `Cannot transition from ${current.status} to ${targetStatus}`,
      'INVALID_TRANSITION',
    );
  }

  const reservation = await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: targetStatus },
  });

  console.log(
    `[RESERVATION] ${current.status} -> ${targetStatus}: ${reservationId}`,
  );

  return reservation;
}

export async function payCommissionTx(
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
  >,
  reservationId: string,
  referrerId: string,
  commissionAmount: number,
) {
  const points = calculateCommission(commissionAmount);

  await tx.user.update({
    where: { id: referrerId },
    data: {
      totalEarnings: { increment: commissionAmount },
      totalReferrals: { increment: 1 },
      points: { increment: points },
    },
  });

  await tx.transaction.create({
    data: {
      userId: referrerId,
      type: 'commission',
      amount: commissionAmount,
      points,
      description: `Komisi referral dari reservasi`,
      referenceId: reservationId,
    },
  });

  await tx.reservation.update({
    where: { id: reservationId },
    data: { commissionPaid: true },
  });

  console.log(`[COMMISSION] Paid Rp ${commissionAmount} to ${referrerId}`);
}

export { type ReservationStatus };
