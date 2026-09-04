import { NextResponse } from 'next/server';
import { Prisma, type OpsRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { addDateKeys, dateKeyFromDate, dateKeyToDate } from '@/lib/treatment-operations/date';
import { DAY_OFF_MANAGEMENT_ROLES, parseOpsDateOnly, serializeDayOff } from '@/lib/treatment-operations/day-off';
import { handleOpsError, readJson } from '@/lib/treatment-operations/http';
import { OpsError, serialize } from '@/lib/treatment-operations/utils';

const DAY_OFF_LOOKAHEAD_DAYS = 180;

function canManageDayOffs(role: OpsRole): boolean {
  return DAY_OFF_MANAGEMENT_ROLES.includes(role as (typeof DAY_OFF_MANAGEMENT_ROLES)[number]);
}

function branchScope(actor: { role: OpsRole; branchId: string | null }) {
  return actor.role === 'SUPER_ADMIN' ? {} : { branchId: actor.branchId || '' };
}

export async function GET(request: Request) {
  try {
    const actor = await requireOpsStaff();
    const params = new URL(request.url).searchParams;
    const today = dateKeyFromDate(new Date());
    const from = params.get('from') ? parseOpsDateOnly(params.get('from')) : today;
    const to = params.get('to') ? parseOpsDateOnly(params.get('to')) : addDateKeys(from, DAY_OFF_LOOKAHEAD_DAYS);
    if (to < from) throw new OpsError(422, 'Rentang tanggal libur tidak valid.');

    const requestedStaffId = params.get('staffId')?.trim() || actor.id;
    if (requestedStaffId !== actor.id && !canManageDayOffs(actor.role)) {
      throw new OpsError(403, 'Anda hanya dapat melihat jadwal libur sendiri.');
    }
    const selectedStaff = await prisma.opsStaff.findFirst({
      where: { id: requestedStaffId, active: true, ...branchScope(actor) },
      select: { id: true, branchId: true, employeeId: true, name: true, role: true },
    });
    if (!selectedStaff) throw new OpsError(404, 'Staf aktif tidak ditemukan pada cakupan Anda.');

    const [dayOffs, staff] = await Promise.all([
      prisma.opsStaffDayOff.findMany({
        where: {
          staffId: selectedStaff.id,
          date: { gte: dateKeyToDate(from), lte: dateKeyToDate(to) },
        },
        select: { id: true, staffId: true, date: true, note: true, createdAt: true },
        orderBy: { date: 'asc' },
      }),
      canManageDayOffs(actor.role)
        ? prisma.opsStaff.findMany({
            where: { active: true, ...branchScope(actor) },
            select: { id: true, branchId: true, employeeId: true, name: true, role: true },
            orderBy: { name: 'asc' },
          })
        : Promise.resolve([]),
    ]);

    return NextResponse.json(serialize({
      canManageAll: canManageDayOffs(actor.role),
      viewer: { id: actor.id, name: actor.name, role: actor.role },
      selectedStaff,
      selectedStaffId: selectedStaff.id,
      staff,
      dayOffs: dayOffs.map(serializeDayOff),
    }), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleOpsError(error, 'list staff day offs');
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireOpsStaff();
    const body = await readJson(request);
    const date = parseOpsDateOnly(body.date);
    if (date < dateKeyFromDate(new Date())) {
      throw new OpsError(422, 'Tanggal libur tidak boleh berada di masa lalu.');
    }

    const requestedStaffId = typeof body.staffId === 'string' ? body.staffId.trim() : '';
    if (requestedStaffId && requestedStaffId !== actor.id && !canManageDayOffs(actor.role)) {
      throw new OpsError(403, 'Anda hanya dapat mengatur jadwal libur sendiri.');
    }
    const targetStaffId = requestedStaffId || actor.id;
    const targetStaff = await prisma.opsStaff.findFirst({
      where: { id: targetStaffId, active: true, ...branchScope(actor) },
      select: { id: true, branchId: true, employeeId: true, name: true, role: true },
    });
    if (!targetStaff) throw new OpsError(404, 'Staf aktif tidak ditemukan pada cakupan Anda.');

    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if (note.length > 240) throw new OpsError(422, 'Catatan libur maksimal 240 karakter.');

    const dayOff = await prisma.$transaction(async (tx) => {
      const created = await tx.opsStaffDayOff.create({
        data: {
          staffId: targetStaff.id,
          date: dateKeyToDate(date),
          note: note || null,
          createdById: actor.id,
        },
        select: { id: true, staffId: true, date: true, note: true, createdAt: true },
      });
      await tx.opsAuditLog.create({
        data: {
          actorUserId: actor.id,
          branchId: targetStaff.branchId,
          entityType: 'STAFF_DAY_OFF',
          entityId: created.id,
          action: 'CREATE',
          afterData: { staffId: targetStaff.id, date, note: note || null },
        },
      });
      return created;
    });

    return NextResponse.json(serialize({ dayOff: serializeDayOff(dayOff) }), { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return handleOpsError(new OpsError(409, 'Tanggal tersebut sudah ditandai sebagai libur.'), 'create staff day off');
    }
    return handleOpsError(error, 'create staff day off');
  }
}
