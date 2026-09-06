import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { DAY_OFF_MANAGEMENT_ROLES, serializeDayOff } from '@/lib/treatment-operations/day-off';
import { handleOpsError, readJson } from '@/lib/treatment-operations/http';
import { OpsError, serialize } from '@/lib/treatment-operations/utils';

function canManageDayOffs(role: string): boolean {
  return DAY_OFF_MANAGEMENT_ROLES.includes(role as (typeof DAY_OFF_MANAGEMENT_ROLES)[number]);
}

const SELECT = {
  id: true,
  staffId: true,
  date: true,
  note: true,
  createdAt: true,
  status: true,
  approvedAt: true,
  approvedBy: { select: { id: true, name: true } },
} as const;

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireOpsStaff();
    const { id } = await context.params;
    const dayOff = await prisma.opsStaffDayOff.findUnique({
      where: { id },
      include: { staff: { select: { id: true, branchId: true, name: true } } },
    });
    if (!dayOff) throw new OpsError(404, 'Jadwal libur tidak ditemukan.');

    const isManager = canManageDayOffs(actor.role);
    if (!isManager && dayOff.staffId !== actor.id) {
      throw new OpsError(403, 'Anda hanya dapat menghapus jadwal libur sendiri.');
    }
    if (!isManager && dayOff.status === 'APPROVED') {
      throw new OpsError(403, 'Jadwal libur yang disetujui hanya dapat dihapus Super Admin/Manajemen.');
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
          beforeData: { staffId: dayOff.staffId, date: dayOff.date.toISOString(), note: dayOff.note, status: dayOff.status },
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleOpsError(error, 'delete staff day off');
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireOpsStaff();
    if (!canManageDayOffs(actor.role)) {
      throw new OpsError(403, 'Hanya Super Admin/Manajemen yang dapat menyetujui jadwal libur.');
    }
    const { id } = await context.params;
    const body = await readJson(request);
    const action = body.action;
    if (action !== 'APPROVE' && action !== 'REJECT') {
      throw new OpsError(400, 'Aksi tidak valid. Gunakan APPROVE atau REJECT.');
    }

    const dayOff = await prisma.opsStaffDayOff.findUnique({
      where: { id },
      include: { staff: { select: { id: true, branchId: true } } },
    });
    if (!dayOff) throw new OpsError(404, 'Jadwal libur tidak ditemukan.');
    if (dayOff.status !== 'PENDING') throw new OpsError(409, 'Jadwal libur ini sudah diproses.');
    if (actor.role !== 'SUPER_ADMIN' && dayOff.staff.branchId !== actor.branchId) {
      throw new OpsError(403, 'Jadwal libur berasal dari cabang lain.');
    }

    const nextStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const decidedAt = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.opsStaffDayOff.update({
        where: { id },
        data: { status: nextStatus, approvedById: actor.id, approvedAt: decidedAt },
        select: SELECT,
      });
      await tx.opsAuditLog.create({
        data: {
          actorUserId: actor.id,
          branchId: dayOff.staff.branchId,
          entityType: 'STAFF_DAY_OFF',
          entityId: dayOff.id,
          action: action === 'APPROVE' ? 'APPROVE' : 'REJECT',
          afterData: { staffId: dayOff.staffId, date: dayOff.date.toISOString(), decidedAt: decidedAt.toISOString() },
        },
      });
      return result;
    });

    return NextResponse.json(serialize({ dayOff: serializeDayOff(updated) }), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleOpsError(error, 'decide staff day off');
  }
}
