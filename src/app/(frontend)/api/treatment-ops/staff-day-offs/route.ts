import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { ORDER_MANAGEMENT_ROLES } from '@/lib/treatment-operations/constants';
import { dateKeyFromDate, dateKeyToDate } from '@/lib/treatment-operations/date';
import { parseOpsDateOnly } from '@/lib/treatment-operations/day-off';
import { handleOpsError } from '@/lib/treatment-operations/http';
import { OpsError, serialize } from '@/lib/treatment-operations/utils';

export async function GET(request: Request) {
  try {
    const actor = await requireOpsStaff(ORDER_MANAGEMENT_ROLES);
    const params = new URL(request.url).searchParams;
    const requestedDate = params.get('date')?.trim() || '';
    if (!requestedDate) throw new OpsError(422, 'Tanggal kunjungan wajib diisi.');
    const date = parseOpsDateOnly(requestedDate);
    const requestedBranchId = params.get('branchId')?.trim() || '';
    const branchId = actor.role === 'SUPER_ADMIN' ? requestedBranchId : actor.branchId || '';
    if (actor.role !== 'SUPER_ADMIN' && !branchId) throw new OpsError(422, 'Cabang wajib dipilih.');

    const branch = branchId
      ? await prisma.opsBranch.findFirst({
          where: {
            id: branchId,
            active: true,
            ...(actor.role === 'SUPER_ADMIN' ? {} : { id: actor.branchId || '' }),
          },
          select: { id: true },
        })
      : null;
    if (branchId && !branch) throw new OpsError(404, 'Cabang aktif tidak ditemukan pada cakupan Anda.');

    const dayOffs = await prisma.opsStaffDayOff.findMany({
      where: {
        date: dateKeyToDate(date),
        status: 'APPROVED',
        staff: { active: true, ...(branch ? { branchId: branch.id } : {}) },
      },
      select: {
        staffId: true,
        date: true,
        staff: {
          select: {
            id: true,
            employeeId: true,
            name: true,
            role: true,
            branch: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json(serialize({
      date,
      branchId: branch?.id || null,
      staffDayOffs: dayOffs
        .map((dayOff) => ({ staffId: dayOff.staffId, date: dateKeyFromDate(dayOff.date), staff: dayOff.staff }))
        .sort((left, right) => left.staff.name.localeCompare(right.staff.name, 'id-ID')),
    }), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleOpsError(error, 'list staff day offs for order');
  }
}
