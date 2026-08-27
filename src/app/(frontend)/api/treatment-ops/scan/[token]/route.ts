import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { handleOpsError } from '@/lib/treatment-operations/http';
import { hashQrToken, maskPatientName, OpsError, serialize } from '@/lib/treatment-operations/utils';

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const actor = await requireOpsStaff();
    const { token } = await context.params;
    const order = await prisma.opsTreatmentOrder.findUnique({
      where: { qrTokenHash: hashQrToken(token) },
      include: {
        actions: {
          include: {
            assignedTherapist: { select: { id: true, name: true } },
            performedTherapist: { select: { id: true, name: true } },
          },
          orderBy: { sequenceNumber: 'asc' },
        },
      },
    });
    if (!order || order.qrRevokedAt || (order.qrTokenExpiresAt && order.qrTokenExpiresAt < new Date())) {
      throw new OpsError(404, 'QR tidak valid, kedaluwarsa, atau telah dicabut.');
    }
    if (actor.branchId !== order.branchId && actor.role !== 'SUPER_ADMIN') throw new OpsError(403, 'Order berasal dari cabang lain.');
    await prisma.opsActionEvent.create({
      data: { treatmentOrderId: order.id, eventType: 'SCAN', actorUserId: actor.id },
    });
    return NextResponse.json(serialize({
      actor: { id: actor.id, name: actor.name, role: actor.role },
      order: { ...order, patientNameSnapshot: maskPatientName(order.patientNameSnapshot) },
    }));
  } catch (error) {
    return handleOpsError(error, 'scan QR');
  }
}
