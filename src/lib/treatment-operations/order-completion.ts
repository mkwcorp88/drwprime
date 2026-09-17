import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { calculateSpendingPoints, computeMemberTierFromSpending } from '@/lib/policies/loyalty';
import { sendSpendingNotification } from '@/lib/whatsapp';
import { OpsStaff } from '@prisma/client';

export async function handleOrderCompletionPointsAndNotification(
  orderId: string,
) {
  return prisma.$transaction(async (tx) => {
    // 1. Get the order with necessary relations
    const order = await tx.opsTreatmentOrder.findUnique({
      where: { id: orderId },
      include: { patient: true },
    });

    if (!order || order.status !== 'COMPLETED') return null;

    // 2. Check idempotency: Have points already been awarded for this order?
    const existingRecord = await tx.spendingRecord.findUnique({
      where: { source_externalId: { source: 'treatment_ops', externalId: order.id } },
    });

    if (existingRecord) return null; // Already processed

    const amount = Number(order.finalPrice);
    const pointsEarned = calculateSpendingPoints(amount);

    // 3. Identify user (Patient)
    let user = null;
    if (order.patient.phone) {
      user = await tx.user.findUnique({ where: { phone: order.patient.phone } });
    }

    // 4. Create or Update user
    let isNewMember = false;
    if (!user) {
      user = await tx.user.create({
        data: {
          firstName: order.patientNameSnapshot,
          phone: order.patient.phone,
          hasAccount: false,
          qrToken: require('node:crypto').randomUUID(),
        },
      });
      isNewMember = true;
    }

    // 5. Update user totals and create spending record
    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: {
        points: { increment: pointsEarned },
        totalSpending: { increment: amount },
        loyaltyLevel: computeMemberTierFromSpending(Number(user.totalSpending) + amount),
        lastTransactionAt: new Date(),
      },
    });

    await tx.spendingRecord.create({
      data: {
        userId: user.id,
        amount: new Prisma.Decimal(amount),
        treatment: order.treatmentNameSnapshot,
        pointsEarned,
        spendingDate: new Date(),
        source: 'treatment_ops',
        externalId: order.id,
      },
    });

    // 6. Create transaction record for audit
    if (pointsEarned > 0) {
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: 'points_earned',
          amount: new Prisma.Decimal(amount),
          points: pointsEarned,
          description: `Poin dari treatment selesai (${pointsEarned} poin)`,
          referenceId: order.id,
        },
      });
    }

    // 7. Audit log
    await tx.opsAuditLog.create({
      data: {
        actorUserId: order.createdById,
        branchId: order.branchId,
        entityType: 'TREATMENT_ORDER',
        entityId: order.id,
        action: 'POINTS_AWARDED',
        afterData: { pointsEarned, totalSpending: updatedUser.totalSpending },
      },
    });

    // Count total transactions for this member
    const transactionCount = await tx.spendingRecord.count({
      where: { userId: user.id },
    });

    return {
      user: {
        ...user,
        ...updatedUser,
      },
      pointsEarned,
      newTotalSpending: Number(updatedUser.totalSpending),
      newTier: updatedUser.loyaltyLevel,
      isNewMember,
      order,
      transactionCount,
    };
  });
}
