import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { handleOpsError } from '@/lib/treatment-operations/http';
import { serialize } from '@/lib/treatment-operations/utils';

export async function GET() {
  try {
    const actor = await requireOpsStaff(['SUPER_ADMIN', 'MANAGEMENT']);
    const staff = await prisma.opsStaff.findMany({
      where: actor.role === 'SUPER_ADMIN' ? {} : { branchId: actor.branchId || '' },
      select: {
        id: true, branchId: true, employeeId: true, name: true, role: true, active: true,
        badgeIssuedAt: true,
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
    return NextResponse.json(serialize({ staff }));
  } catch (error) {
    return handleOpsError(error, 'list staff');
  }
}
