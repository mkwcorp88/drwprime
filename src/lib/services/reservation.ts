import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { calculateCommission } from '@/lib/policies/commission';
import { calculateSpendingPoints } from '@/lib/policies/loyalty';
import { isAidoManagedSpendingDate } from '@/lib/aido/config';

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

function tierForSpending(totalSpending: number): 'Bronze' | 'Silver' | 'Gold' | 'Platinum' {
  if (totalSpending >= 10_000_000) return 'Platinum';
  if (totalSpending >= 5_000_000) return 'Gold';
  if (totalSpending >= 1_000_000) return 'Silver';
  return 'Bronze';
}

export async function confirmReservation(reservationId: string) {
  return transitionStatus(reservationId, 'confirmed');
}

export async function completeReservation(
  reservationId: string,
  options: { finalPrice?: number; adminNotes?: string } = {},
) {
  const completedAt = new Date();
  return prisma.$transaction(async (tx) => {
    const current = await tx.reservation.findUnique({ where: { id: reservationId } });
    if (!current) {
      throw new ReservationError('Reservation not found', 'NOT_FOUND');
    }
    if (current.status !== 'confirmed') {
      throw new ReservationError(
        `Cannot transition from ${current.status} to completed`,
        'INVALID_TRANSITION',
      );
    }

    const finalPrice = options.finalPrice !== undefined
      ? options.finalPrice
      : Number(current.finalPrice);
    if (!Number.isFinite(finalPrice) || finalPrice <= 0) {
      throw new ReservationError('Final price is invalid', 'INVALID_PRICE');
    }

    const commissionAmount = calculateCommission(finalPrice);
    const reservation = await tx.reservation.update({
      where: { id: reservationId },
      data: {
        status: 'completed',
        completedAt,
        finalPrice,
        commissionAmount,
        adminNotes: options.adminNotes ?? null,
      },
    });

    // Award spending points to the user
    if (current.userId && !isAidoManagedSpendingDate(completedAt)) {
      const pointsEarned = calculateSpendingPoints(finalPrice);
      const user = await tx.user.findUnique({
        where: { id: current.userId },
        select: { points: true, totalSpending: true },
      });

      if (user) {
        const newTotalSpending = Number(user.totalSpending) + finalPrice;
        await tx.user.update({
          where: { id: current.userId },
          data: {
            points: { increment: pointsEarned },
            totalSpending: { increment: finalPrice },
            loyaltyPoints: { increment: pointsEarned },
            loyaltyLevel: tierForSpending(newTotalSpending),
            lastTransactionAt: completedAt,
          },
        });

        if (pointsEarned > 0) {
          await tx.transaction.create({
            data: {
              userId: current.userId,
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
    if (current.referrerId && commissionAmount > 0) {
      await payCommissionTx(tx, reservationId, current.referrerId, commissionAmount);
    }
    return reservation;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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
    select: { userId: true, status: true, finalPrice: true, commissionPaid: true, referrerId: true },
  });

  if (!reservation) {
    throw new ReservationError('Reservasi tidak ditemukan', 'NOT_FOUND');
  }

  if (reservation.commissionPaid) {
    throw new ReservationError('Komisi reservasi sudah dibayarkan', 'COMMISSION_PAID');
  }
  if (reservation.referrerId && reservation.referrerId !== referrer.id) {
    throw new ReservationError('Affiliate reservasi sudah ditetapkan', 'REFERRER_ASSIGNED');
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
  return prisma.$transaction(async (tx) => {
    const current = await tx.reservation.findUnique({ where: { id: reservationId } });
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

    const result = await tx.reservation.updateMany({
      where: { id: reservationId, status: current.status },
      data: { status: targetStatus },
    });
    if (result.count !== 1) {
      throw new ReservationError('Reservation was changed by another request', 'CONCURRENT_UPDATE');
    }

    const reservation = await tx.reservation.findUniqueOrThrow({ where: { id: reservationId } });
    console.log(`[RESERVATION] ${current.status} -> ${targetStatus}: ${reservationId}`);
    return reservation;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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
