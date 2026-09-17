import { randomUUID } from 'node:crypto';
import { Prisma, type User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';
import { calculateSpendingPoints, computeMemberTierFromSpending } from '@/lib/policies/loyalty';

type MemberMatch =
  | { kind: 'not_found' }
  | { kind: 'matched'; user: User }
  | { kind: 'ambiguous' };

function normalizedIndonesianPhone(phone: string | null): string | null {
  if (!phone) return null;
  const normalized = normalizePhone(phone);
  return /^628\d{7,12}$/.test(normalized) ? normalized : null;
}

function normalizedMrNumber(mrNumber: string | null): string | null {
  const normalized = mrNumber?.trim();
  return normalized || null;
}

function notificationPhoneFor(user: Pick<User, 'loginPhone' | 'phone'>, fallback: string | null): string | null {
  return normalizedIndonesianPhone(user.loginPhone)
    ?? normalizedIndonesianPhone(user.phone)
    ?? fallback;
}

async function lock(tx: Prisma.TransactionClient, ...keys: string[]) {
  for (const key of [...new Set(keys)].sort()) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
  }
}

async function findMemberByPhone(tx: Prisma.TransactionClient, phone: string): Promise<MemberMatch> {
  const matches = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM users
    WHERE (
      CASE
        WHEN regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') LIKE '62%'
          THEN regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')
        WHEN regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') LIKE '0%'
          THEN '62' || substr(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), 2)
        WHEN regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') LIKE '8%'
          THEN '62' || regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')
        ELSE NULL
      END
    ) = ${phone}
    OR (
      CASE
        WHEN regexp_replace(COALESCE(login_phone, ''), '[^0-9]', '', 'g') LIKE '62%'
          THEN regexp_replace(COALESCE(login_phone, ''), '[^0-9]', '', 'g')
        WHEN regexp_replace(COALESCE(login_phone, ''), '[^0-9]', '', 'g') LIKE '0%'
          THEN '62' || substr(regexp_replace(COALESCE(login_phone, ''), '[^0-9]', '', 'g'), 2)
        WHEN regexp_replace(COALESCE(login_phone, ''), '[^0-9]', '', 'g') LIKE '8%'
          THEN '62' || regexp_replace(COALESCE(login_phone, ''), '[^0-9]', '', 'g')
        ELSE NULL
      END
    ) = ${phone}
  `;

  if (!matches.length) return { kind: 'not_found' };

  const users = await tx.user.findMany({ where: { id: { in: matches.map((match) => match.id) } } });
  const accountUsers = users.filter((user) => user.hasAccount);

  if (accountUsers.length === 1) return { kind: 'matched', user: accountUsers[0] };
  if (users.length === 1) return { kind: 'matched', user: users[0] };
  return { kind: 'ambiguous' };
}

async function findMemberByMrNumber(tx: Prisma.TransactionClient, mrNumber: string | null): Promise<User | null> {
  if (!mrNumber) return null;
  return tx.user.findUnique({ where: { nomorRekamMedis: mrNumber } });
}

async function auditSkippedPoints(
  tx: Prisma.TransactionClient,
  order: { id: string; branchId: string; createdById: string },
  reason: string,
) {
  await tx.opsAuditLog.create({
    data: {
      actorUserId: order.createdById,
      branchId: order.branchId,
      entityType: 'TREATMENT_ORDER',
      entityId: order.id,
      action: 'POINTS_SKIPPED',
      reason,
    },
  });
}

export async function handleOrderCompletionPointsAndNotification(
  orderId: string,
) {
  return prisma.$transaction(async (tx) => {
    await lock(tx, `treatment-order-points:${orderId}`);

    const order = await tx.opsTreatmentOrder.findUnique({
      where: { id: orderId },
      include: { patient: true },
    });

    if (!order || order.status !== 'COMPLETED') return null;

    const existingRecord = await tx.spendingRecord.findUnique({
      where: { source_externalId: { source: 'treatment_ops', externalId: order.id } },
    });

    if (existingRecord) return null;

    const patientPhone = normalizedIndonesianPhone(order.patient.phone);
    const mrNumber = normalizedMrNumber(order.patient.mrNumber);
    await lock(
      tx,
      ...(patientPhone ? [`treatment-order-member-phone:${patientPhone}`] : []),
      ...(mrNumber ? [`treatment-order-member-mr:${mrNumber}`] : []),
    );

    const amount = Number(order.finalPrice);
    const pointsEarned = calculateSpendingPoints(amount);
    const spendingDate = order.completedAt ?? new Date();

    const memberMatch = patientPhone ? await findMemberByPhone(tx, patientPhone) : { kind: 'not_found' } as const;
    if (memberMatch.kind === 'ambiguous') {
      await auditSkippedPoints(tx, order, 'Nomor WhatsApp pasien cocok dengan lebih dari satu member.');
      return null;
    }

    let user = memberMatch.kind === 'matched' ? memberMatch.user : null;
    const mrUser = await findMemberByMrNumber(tx, mrNumber);
    if (user && mrUser && user.id !== mrUser.id) {
      await auditSkippedPoints(tx, order, 'Nomor WhatsApp dan nomor rekam medis pasien mengarah ke member yang berbeda.');
      return null;
    }
    user ??= mrUser;

    if (!user && !patientPhone) {
      await auditSkippedPoints(tx, order, 'Nomor WhatsApp pasien tidak tersedia atau tidak valid, dan nomor rekam medis belum terhubung ke member.');
      return null;
    }

    if (!user) {
      user = await tx.user.upsert({
        where: { phone: patientPhone! },
        update: {},
        create: {
          firstName: order.patientNameSnapshot,
          phone: patientPhone!,
          hasAccount: false,
          qrToken: randomUUID(),
        },
      });
    }

    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: {
        points: { increment: pointsEarned },
        totalSpending: { increment: amount },
        loyaltyLevel: computeMemberTierFromSpending(Number(user.totalSpending) + amount),
        lastTransactionAt: spendingDate,
      },
    });

    await tx.spendingRecord.create({
      data: {
        userId: user.id,
        amount: new Prisma.Decimal(amount),
        treatment: order.treatmentNameSnapshot,
        pointsEarned,
        spendingDate,
        source: 'treatment_ops',
        externalId: order.id,
      },
    });

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

    await tx.opsAuditLog.create({
      data: {
        actorUserId: order.createdById,
        branchId: order.branchId,
        entityType: 'TREATMENT_ORDER',
        entityId: order.id,
        action: 'POINTS_AWARDED',
        afterData: { pointsEarned, totalSpending: Number(updatedUser.totalSpending) },
      },
    });

    return {
      user: updatedUser,
      notificationPhone: notificationPhoneFor(updatedUser, patientPhone),
      pointsEarned,
      newTotalSpending: Number(updatedUser.totalSpending),
      newTier: updatedUser.loyaltyLevel,
      order,
    };
  });
}
