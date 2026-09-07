import { NextResponse } from 'next/server';
import type { OpsRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { handleOpsError, readJson } from '@/lib/treatment-operations/http';
import { OpsError } from '@/lib/treatment-operations/utils';

const ORDER_DELETE_ROLES: OpsRole[] = ['SUPER_ADMIN'];

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireOpsStaff(ORDER_DELETE_ROLES);
    const { id } = await context.params;
    const body = await readJson(request);
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (reason.length < 2 || reason.length > 240) {
      throw new OpsError(422, 'Alasan penghapusan wajib diisi (2-240 karakter).');
    }

    const order = await prisma.opsTreatmentOrder.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        branchId: true,
        status: true,
        patientNameSnapshot: true,
        treatmentNameSnapshot: true,
        cancellationReason: true,
      },
    });
    if (!order) throw new OpsError(404, 'Order tidak ditemukan.');
    if (order.status !== 'CANCELLED') {
      throw new OpsError(409, 'Hanya order yang sudah dibatalkan yang dapat dihapus permanen.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.opsAuditLog.create({
        data: {
          actorUserId: actor.id,
          branchId: order.branchId,
          entityType: 'TREATMENT_ORDER',
          entityId: order.id,
          action: 'DELETE',
          reason,
          beforeData: {
            orderNumber: order.orderNumber,
            patientName: order.patientNameSnapshot,
            treatmentName: order.treatmentNameSnapshot,
            status: order.status,
            cancellationReason: order.cancellationReason,
          },
        },
      });
      await tx.opsIncentiveLedger.deleteMany({ where: { treatmentOrderId: order.id } });
      await tx.opsActionEvent.deleteMany({ where: { treatmentOrderId: order.id } });
      await tx.opsOrderAssignment.deleteMany({ where: { treatmentOrderId: order.id } });
      await tx.opsOrderAction.deleteMany({ where: { treatmentOrderId: order.id } });
      await tx.opsTreatmentOrder.delete({ where: { id: order.id } });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleOpsError(error, 'permanently delete cancelled order');
  }
}
