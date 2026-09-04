import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { DAY_OFF_MANAGEMENT_ROLES } from '@/lib/treatment-operations/day-off';
import { handleOpsError } from '@/lib/treatment-operations/http';
import { OpsError } from '@/lib/treatment-operations/utils';

function canManageDayOffs(role: string): boolean {
  return DAY_OFF_MANAGEMENT_ROLES.includes(role as (typeof DAY_OFF_MANAGEMENT_ROLES)[number]);
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireOpsStaff();
    const { id } = await context.params;
    const dayOff = await prisma.opsStaffDayOff.findUnique({
      where: { id },
      include: { staff: { select: { id: true, branchId: true, name: true } } },
    });
    if (!dayOff) throw new OpsError(404, 'Jadwal libur tidak ditemukan.');
    if (!canManageDayOffs(actor.role) && dayOff.staffId !== actor.id) {
      throw new OpsError(403, 'Anda hanya dapat menghapus jadwal libur sendiri.');
    }
    if (actor.role !== 'SUPER_ADMIN' && dayOff.staff.branchId !== actor.branchId) {
      throw new OpsError(403, 'Jadwal libur berasal dari cabang lain.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.opsStaffDayOff.delete({ where: { id: dayOff.id } });
      await tx.opsAuditLog.create({
        data: {
          actorUserId: actor.id,
          branchId: dayOff.staff.branchId,
          entityType: 'STAFF_DAY_OFF',
          entityId: dayOff.id,
          action: 'DELETE',
          beforeData: { staffId: dayOff.staffId, date: dayOff.date.toISOString(), note: dayOff.note },
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleOpsError(error, 'delete staff day off');
  }
}
