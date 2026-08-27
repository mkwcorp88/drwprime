import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { ORDER_MANAGEMENT_ROLES } from '@/lib/treatment-operations/constants';
import { handleOpsError } from '@/lib/treatment-operations/http';
import { createQrToken, hashQrToken, OpsError } from '@/lib/treatment-operations/utils';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireOpsStaff(ORDER_MANAGEMENT_ROLES);
    const { id } = await context.params;
    const order = await prisma.opsTreatmentOrder.findUnique({ where: { id } });
    if (!order) throw new OpsError(404, 'Order tidak ditemukan.');
    if (actor.role !== 'SUPER_ADMIN' && actor.branchId !== order.branchId) throw new OpsError(403, 'Order berasal dari cabang lain.');
    const token = createQrToken();
    await prisma.opsTreatmentOrder.update({
      where: { id }, data: { qrTokenHash: hashQrToken(token), qrRevokedAt: null },
    });
    return NextResponse.json({ qrToken: token });
  } catch (error) {
    return handleOpsError(error, 'refresh QR');
  }
}
