import { Prisma, type OpsStaff } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createQrToken, hashQrToken, jakartaPeriod, OpsError } from './utils';

type CreateOrderInput = {
  branchId: string;
  patientId: string;
  doctorId?: string | null;
  treatmentId: string;
  visitDate: Date;
  originalPrice: number;
  discountAmount: number;
  internalNote?: string | null;
};

function orderNumberSuffix(sequence: number): string {
  return sequence.toString().padStart(3, '0');
}

export async function createTreatmentOrder(actor: OpsStaff, input: CreateOrderInput) {
  if (actor.role !== 'SUPER_ADMIN' && actor.branchId !== input.branchId) {
    throw new OpsError(403, 'Tidak dapat membuat order untuk cabang lain.');
  }
  if (!Number.isFinite(input.originalPrice) || input.originalPrice < 0) throw new OpsError(400, 'Harga tidak valid.');
  if (!Number.isFinite(input.discountAmount) || input.discountAmount < 0 || input.discountAmount > input.originalPrice) {
    throw new OpsError(400, 'Diskon tidak valid.');
  }

  const [patient, treatment] = await Promise.all([
    prisma.opsPatient.findUnique({ where: { id: input.patientId } }),
    prisma.opsTreatment.findUnique({
      where: { id: input.treatmentId },
      include: { actionTemplates: { where: { active: true }, orderBy: { sequenceNumber: 'asc' } } },
    }),
  ]);
  if (!patient || patient.branchId !== input.branchId) throw new OpsError(404, 'Pasien tidak ditemukan pada cabang ini.');
  if (!treatment || !treatment.active || treatment.actionTemplates.length === 0) {
    throw new OpsError(422, 'Treatment aktif beserta tahapannya tidak ditemukan.');
  }

  const token = createQrToken();
  const now = new Date();
  const datePart = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: '2-digit', month: '2-digit', day: '2-digit',
  }).format(now).replaceAll('-', '');

  const order = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ops-order-${datePart}`}))`;
    const count = await tx.opsTreatmentOrder.count({
      where: { orderNumber: { startsWith: `TRX-${datePart}-` } },
    });
    const created = await tx.opsTreatmentOrder.create({
      data: {
        orderNumber: `TRX-${datePart}-${orderNumberSuffix(count + 1)}`,
        branchId: input.branchId,
        patientId: input.patientId,
        doctorId: input.doctorId || null,
        treatmentId: input.treatmentId,
        visitDate: input.visitDate,
        originalPrice: input.originalPrice,
        discountAmount: input.discountAmount,
        finalPrice: input.originalPrice - input.discountAmount,
        status: 'CREATED',
        patientNameSnapshot: patient.name,
        treatmentNameSnapshot: treatment.name,
        qrTokenHash: hashQrToken(token),
        internalNote: input.internalNote || null,
        createdById: actor.id,
        actions: {
          create: treatment.actionTemplates.map((template) => ({
            sourceTemplateId: template.id,
            actionNameSnapshot: template.actionName,
            sequenceNumber: template.sequenceNumber,
            isRequired: template.isRequired,
            incentiveTypeSnapshot: template.incentiveType,
            incentiveValueSnapshot: template.incentiveValue,
          })),
        },
      },
      include: { actions: { orderBy: { sequenceNumber: 'asc' } } },
    });
    await tx.opsActionEvent.create({
      data: { treatmentOrderId: created.id, eventType: 'CREATE', actorUserId: actor.id },
    });
    await tx.opsAuditLog.create({
      data: {
        actorUserId: actor.id,
        branchId: input.branchId,
        entityType: 'TREATMENT_ORDER',
        entityId: created.id,
        action: 'CREATE',
        afterData: { orderNumber: created.orderNumber, status: created.status },
      },
    });
    return created;
  });
  return { order, qrToken: token };
}

export async function assignAction(actor: OpsStaff, actionId: string, therapistId: string, reason?: string) {
  return prisma.$transaction(async (tx) => {
    const action = await tx.opsOrderAction.findUnique({ where: { id: actionId }, include: { order: true } });
    const therapist = await tx.opsStaff.findUnique({ where: { id: therapistId } });
    if (!action) throw new OpsError(404, 'Tindakan tidak ditemukan.');
    if (!therapist || therapist.role !== 'THERAPIST' || !therapist.active || therapist.branchId !== action.order.branchId) {
      throw new OpsError(422, 'Terapis aktif pada cabang ini tidak ditemukan.');
    }
    if (['ON_PROCESS', 'COMPLETED', 'SKIPPED', 'CANCELLED'].includes(action.status)) {
      throw new OpsError(409, 'Assignment tidak dapat diubah pada status tindakan saat ini.');
    }
    await tx.opsOrderAssignment.updateMany({
      where: { orderActionId: action.id, unassignedAt: null }, data: { unassignedAt: new Date(), reason },
    });
    await tx.opsOrderAssignment.create({
      data: {
        treatmentOrderId: action.treatmentOrderId,
        orderActionId: action.id,
        therapistId,
        assignedById: actor.id,
        reason,
      },
    });
    const updated = await tx.opsOrderAction.update({
      where: { id: action.id }, data: { assignedTherapistId: therapistId, status: 'ASSIGNED' },
    });
    await tx.opsTreatmentOrder.update({ where: { id: action.order.id }, data: { status: 'ASSIGNED' } });
    await tx.opsActionEvent.create({
      data: {
        treatmentOrderId: action.order.id, orderActionId: action.id, eventType: 'ASSIGN', actorUserId: actor.id,
        metadata: { therapistId, therapistName: therapist.name, reason: reason || null },
      },
    });
    return updated;
  });
}

export async function startAction(actor: OpsStaff, actionId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM ops_order_actions WHERE id = ${actionId} FOR UPDATE`;
    const action = await tx.opsOrderAction.findUnique({
      where: { id: actionId }, include: { order: { include: { actions: { orderBy: { sequenceNumber: 'asc' } } } } },
    });
    if (!action) throw new OpsError(404, 'Tindakan tidak ditemukan.');
    if (actor.branchId !== action.order.branchId) throw new OpsError(403, 'Order berasal dari cabang lain.');
    if (!['PENDING', 'ASSIGNED'].includes(action.status)) throw new OpsError(409, 'Tindakan sudah dimulai atau tidak tersedia.');
    if (action.assignedTherapistId && action.assignedTherapistId !== actor.id) {
      throw new OpsError(403, 'Tindakan ini ditugaskan kepada terapis lain.');
    }
    const unfinishedRequiredBefore = action.order.actions.some(
      (item) => item.sequenceNumber < action.sequenceNumber && item.isRequired && item.status !== 'COMPLETED',
    );
    if (unfinishedRequiredBefore) throw new OpsError(409, 'Selesaikan tindakan wajib sebelumnya terlebih dahulu.');

    const now = new Date();
    const updated = await tx.opsOrderAction.update({
      where: { id: action.id }, data: { status: 'ON_PROCESS', performedByTherapistId: actor.id, startedAt: now },
    });
    await tx.opsTreatmentOrder.update({ where: { id: action.order.id }, data: { status: 'ON_PROCESS' } });
    await tx.opsActionEvent.create({
      data: { treatmentOrderId: action.order.id, orderActionId: action.id, eventType: 'START', actorUserId: actor.id },
    });
    return updated;
  });
}

export async function completeAction(actor: OpsStaff, actionId: string, note?: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM ops_order_actions WHERE id = ${actionId} FOR UPDATE`;
    const action = await tx.opsOrderAction.findUnique({ where: { id: actionId }, include: { order: true } });
    if (!action) throw new OpsError(404, 'Tindakan tidak ditemukan.');
    if (action.status !== 'ON_PROCESS' || !action.startedAt) throw new OpsError(409, 'Tindakan belum dimulai atau sudah selesai.');
    if (action.performedByTherapistId !== actor.id) throw new OpsError(403, 'Hanya terapis yang memulai yang dapat menyelesaikan tindakan.');

    const now = new Date();
    const amount = action.incentiveTypeSnapshot === 'FIXED' ? action.incentiveValueSnapshot : new Prisma.Decimal(0);
    const updated = await tx.opsOrderAction.update({
      where: { id: action.id },
      data: {
        status: 'COMPLETED', completedAt: now,
        durationSeconds: Math.max(0, Math.floor((now.getTime() - action.startedAt.getTime()) / 1000)),
        calculatedIncentive: amount, completionNote: note || null,
      },
    });
    await tx.opsIncentiveLedger.upsert({
      where: { orderActionId: action.id },
      update: {},
      create: {
        branchId: action.order.branchId, therapistId: actor.id, treatmentOrderId: action.order.id,
        orderActionId: action.id, amount, status: 'ELIGIBLE', period: jakartaPeriod(now),
      },
    });
    await tx.opsActionEvent.create({
      data: {
        treatmentOrderId: action.order.id, orderActionId: action.id, eventType: 'COMPLETE', actorUserId: actor.id,
        metadata: { incentive: amount.toString() },
      },
    });

    const remainingRequired = await tx.opsOrderAction.count({
      where: { treatmentOrderId: action.order.id, isRequired: true, status: { not: 'COMPLETED' } },
    });
    const active = await tx.opsOrderAction.count({
      where: { treatmentOrderId: action.order.id, status: 'ON_PROCESS' },
    });
    await tx.opsTreatmentOrder.update({
      where: { id: action.order.id },
      data: remainingRequired === 0
        ? { status: 'COMPLETED', completedAt: now }
        : { status: active > 0 ? 'ON_PROCESS' : 'WAITING_NEXT_ACTION' },
    });
    return updated;
  });
}
