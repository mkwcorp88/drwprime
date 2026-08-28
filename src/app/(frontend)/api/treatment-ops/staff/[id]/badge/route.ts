import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { issueStaffBadge, requireOpsStaff } from '@/lib/treatment-operations/auth';
import { handleOpsError } from '@/lib/treatment-operations/http';
import { createStaffBadgeValue, OpsError } from '@/lib/treatment-operations/utils';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireOpsStaff(['SUPER_ADMIN', 'MANAGEMENT']);
    const { id } = await context.params;
    return NextResponse.json(await issueStaffBadge(actor, id));
  } catch (error) {
    return handleOpsError(error, 'issue staff badge');
  }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireOpsStaff(['SUPER_ADMIN', 'MANAGEMENT']);
    const { id } = await context.params;
    const staff = await prisma.opsStaff.findUnique({
      where: { id },
      select: { id: true, employeeId: true, name: true, role: true, badgeToken: true, badgeIssuedAt: true, avatarUrl: true, branchId: true },
    });
    if (!staff?.badgeToken || !staff.badgeIssuedAt) {
      throw new OpsError(404, 'Kartu belum diterbitkan untuk staf ini.');
    }
    const branch = staff.branchId
      ? await prisma.opsBranch.findUnique({ where: { id: staff.branchId }, select: { name: true } })
      : null;
    return NextResponse.json(
      {
        staff: { id: staff.id, employeeId: staff.employeeId, name: staff.name, role: staff.role },
        badgeValue: createStaffBadgeValue(staff.badgeToken),
        issuedAt: staff.badgeIssuedAt,
        avatarUrl: staff.avatarUrl,
        branchName: branch?.name ?? null,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return handleOpsError(error, 'get staff badge');
  }
}
