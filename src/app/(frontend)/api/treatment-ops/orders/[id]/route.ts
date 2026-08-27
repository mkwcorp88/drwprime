import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { handleOpsError } from '@/lib/treatment-operations/http';
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
