import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { GLOBAL_REPORT_ROLES, INCENTIVE_MANAGEMENT_ROLES, REPORT_ROLES } from '@/lib/treatment-operations/constants';
import { handleOpsError } from '@/lib/treatment-operations/http';
import { OpsError, serialize } from '@/lib/treatment-operations/utils';

const INCENTIVE_STATUSES = ['PENDING', 'ELIGIBLE', 'VERIFIED', 'PAID', 'VOID'] as const;

export async function GET(request: Request) {
  try {
    const actor = await requireOpsStaff();
    const url = new URL(request.url);
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');
    const status = url.searchParams.get('status');
    const branchId = url.searchParams.get('branchId');
    const therapistId = url.searchParams.get('therapistId');
    if (status && !INCENTIVE_STATUSES.includes(status as typeof INCENTIVE_STATUSES[number])) {
      throw new OpsError(422, 'Status insentif tidak valid.');
    }
    if ((start && Number.isNaN(new Date(`${start}T00:00:00+07:00`).getTime())) || (end && Number.isNaN(new Date(`${end}T00:00:00+07:00`).getTime()))) {
      throw new OpsError(422, 'Rentang tanggal tidak valid.');
    }
    const completedAt = start || end ? {
      ...(start ? { gte: new Date(`${start}T00:00:00+07:00`) } : {}),
      ...(end ? { lt: new Date(`${end}T00:00:00+07:00`) } : {}),
    } : undefined;
    const canReport = REPORT_ROLES.includes(actor.role);
    const canSeeAllBranches = GLOBAL_REPORT_ROLES.includes(actor.role);
    const accessFilter = actor.role === 'THERAPIST'
      ? { therapistId: actor.id }
      : canReport
        ? (canSeeAllBranches ? {} : { branchId: actor.branchId || '' })
        : { therapistId: actor.id };
    const entries = await prisma.opsIncentiveLedger.findMany({
      where: {
        ...accessFilter,
        ...(canSeeAllBranches && branchId ? { branchId } : {}),
        ...(canReport && therapistId ? { therapistId } : {}),
        ...(status ? { status: status as typeof INCENTIVE_STATUSES[number] } : {}),
        ...(completedAt ? { orderAction: { completedAt } } : {}),
      },
      include: {
        branch: { select: { id: true, name: true } },
        therapist: { select: { id: true, name: true, employeeId: true } },
        order: { select: { orderNumber: true, treatmentNameSnapshot: true } },
        orderAction: { select: { actionNameSnapshot: true, completedAt: true } },
      },
      orderBy: { orderAction: { completedAt: 'desc' } }, take: 1000,
    });
    const branches = canSeeAllBranches
      ? await prisma.opsBranch.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
      : [];
    const therapists = canReport
      ? await prisma.opsStaff.findMany({
        where: { active: true, ...(canSeeAllBranches ? {} : { branchId: actor.branchId || '' }) },
        select: { id: true, name: true, employeeId: true }, orderBy: { name: 'asc' },
      })
      : [];
    return NextResponse.json(serialize({ entries, branches, therapists, canManage: INCENTIVE_MANAGEMENT_ROLES.includes(actor.role) }));
  } catch (error) {
    return handleOpsError(error, 'incentive report');
  }
}
