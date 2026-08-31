import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { ORDER_MANAGEMENT_ROLES } from '@/lib/treatment-operations/constants';
import { handleOpsError, readJson } from '@/lib/treatment-operations/http';
import { OpsError, serialize } from '@/lib/treatment-operations/utils';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireOpsStaff();
    const { id } = await context.params;
    const order = await prisma.opsTreatmentOrder.findUnique({
      where: { id },
      include: {
        branch: true, patient: true, doctor: true,
        actions: { include: { assignedTherapist: true, performedTherapist: true }, orderBy: { sequenceNumber: 'asc' } },
        events: { include: { actor: { select: { name: true, role: true } } }, orderBy: { eventAt: 'desc' } },
      },
    });
    if (!order) throw new OpsError(404, 'Order tidak ditemukan.');
    if (actor.role !== 'SUPER_ADMIN' && actor.branchId !== order.branchId) throw new OpsError(403, 'Order berasal dari cabang lain.');
    return NextResponse.json(serialize({ order }));
  } catch (error) {
    return handleOpsError(error, 'order detail');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireOpsStaff(ORDER_MANAGEMENT_ROLES);
    const { id } = await context.params;
    const body = await readJson(request);
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (reason.length < 2 || reason.length > 240) {
      throw new OpsError(422, 'Alasan pembatalan wajib diisi (2-240 karakter).');
    }
    const order = await prisma.opsTreatmentOrder.findUnique({
      where: { id }, include: { actions: { select: { status: true } } },
    });
    if (!order) throw new OpsError(404, 'Order tidak ditemukan.');
    if (actor.role !== 'SUPER_ADMIN' && actor.branchId !== order.branchId) throw new OpsError(403, 'Order berasal dari cabang lain.');
    if (!['CREATED', 'ASSIGNED'].includes(order.status) || order.actions.some((action) => !['PENDING', 'ASSIGNED'].includes(action.status))) {
      throw new OpsError(409, 'Order yang sudah dimulai tidak dapat dihapus.');
    }
    await prisma.$transaction(async (tx) => {
      await tx.opsOrderAction.updateMany({
        where: { treatmentOrderId: id }, data: { status: 'CANCELLED', assignedTherapistId: null },
      });
      await tx.opsTreatmentOrder.update({
        where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason, qrRevokedAt: new Date() },
      });
      await tx.opsActionEvent.create({
        data: { treatmentOrderId: id, eventType: 'CANCEL', actorUserId: actor.id, metadata: { reason } },
      });
      await tx.opsAuditLog.create({
        data: { actorUserId: actor.id, branchId: order.branchId, entityType: 'TREATMENT_ORDER', entityId: id, action: 'CANCEL', reason, afterData: { orderNumber: order.orderNumber, status: 'CANCELLED' } },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleOpsError(error, 'cancel order');
  }
}
