import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { handleOpsError } from '@/lib/treatment-operations/http';
import { createStaffBadgeValue, OpsError } from '@/lib/treatment-operations/utils';

export async function GET() {
  try {
    const staff = await requireOpsStaff();
    const me = await prisma.opsStaff.findUnique({
      where: { id: staff.id },
      select: { badgeToken: true, badgeIssuedAt: true, name: true, employeeId: true, role: true, avatarUrl: true, branchId: true },
    });
    if (!me?.badgeToken || !me.badgeIssuedAt) {
      throw new OpsError(404, 'Kartu barcode belum diterbitkan. Minta Super Admin menerbitkannya dari halaman Kartu.');
    }
    const branch = me.branchId
      ? await prisma.opsBranch.findUnique({ where: { id: me.branchId }, select: { name: true } })
      : null;
    return NextResponse.json(
      {
        badgeValue: createStaffBadgeValue(me.badgeToken),
        issuedAt: me.badgeIssuedAt,
        name: me.name,
        employeeId: me.employeeId,
        role: me.role,
        branchName: branch?.name ?? null,
        avatarUrl: me.avatarUrl,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return handleOpsError(error, 'my staff badge');
  }
}
