import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { REPORT_ROLES } from '@/lib/treatment-operations/constants';
import { handleOpsError } from '@/lib/treatment-operations/http';
import { serialize } from '@/lib/treatment-operations/utils';

export async function GET() {
  try {
    const actor = await requireOpsStaff();
    const entries = await prisma.opsIncentiveLedger.findMany({
      where: actor.role === 'THERAPIST'
        ? { therapistId: actor.id }
        : REPORT_ROLES.includes(actor.role)
          ? (actor.role === 'SUPER_ADMIN' ? {} : { branchId: actor.branchId || '' })
          : { therapistId: actor.id },
      include: {
        therapist: { select: { id: true, name: true, employeeId: true } },
        order: { select: { orderNumber: true, treatmentNameSnapshot: true } },
        orderAction: { select: { actionNameSnapshot: true, completedAt: true } },
      },
      orderBy: { createdAt: 'desc' }, take: 500,
    });
    return NextResponse.json(serialize({ entries }));
  } catch (error) {
    return handleOpsError(error, 'incentive report');
  }
}
