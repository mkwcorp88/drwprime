import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { GLOBAL_REPORT_ROLES, REPORT_ROLES, TARGET_MANAGEMENT_ROLES } from '@/lib/treatment-operations/constants';
import { dateKeyFromDate, dateKeyToDate } from '@/lib/treatment-operations/date';
import { handleOpsError, readJson } from '@/lib/treatment-operations/http';
import { OpsError, parseOpsMonth, serialize } from '@/lib/treatment-operations/utils';

const MAX_TARGET_AMOUNT = 999_999_999_999.99;

function targetMonthDate(month: string): Date {
  return dateKeyToDate(`${month}-01`);
}

function targetView(target: {
  id: string;
  branchId: string;
  month: Date;
  targetAmount: Prisma.Decimal;
  updatedAt: Date;
  branch: { id: string; name: string };
}) {
  return {
    id: target.id,
    branchId: target.branchId,
    month: dateKeyFromDate(target.month).slice(0, 7),
    targetAmount: Number(target.targetAmount),
    updatedAt: target.updatedAt,
    branch: target.branch,
  };
}

export async function GET(request: Request) {
  try {
    const actor = await requireOpsStaff(REPORT_ROLES);
    const params = new URL(request.url).searchParams;
    const month = parseOpsMonth(params.get('month'));
    const canSeeAllBranches = GLOBAL_REPORT_ROLES.includes(actor.role);
    const branchFilter = canSeeAllBranches ? {} : { branchId: actor.branchId || '' };
    const [branches, targets] = await Promise.all([
      prisma.opsBranch.findMany({
        where: { active: true, ...(canSeeAllBranches ? {} : { id: actor.branchId || '' }) },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.opsMonthlyRevenueTarget.findMany({
        where: { month: targetMonthDate(month), ...branchFilter },
        select: {
          id: true,
          branchId: true,
          month: true,
          targetAmount: true,
          updatedAt: true,
          branch: { select: { id: true, name: true } },
        },
        orderBy: { branch: { name: 'asc' } },
      }),
    ]);
    return NextResponse.json(serialize({
      month,
      branches,
      targets: targets.map(targetView),
      canManage: TARGET_MANAGEMENT_ROLES.includes(actor.role),
    }), { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return handleOpsError(error, 'list monthly revenue targets');
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requireOpsStaff(TARGET_MANAGEMENT_ROLES);
    const body = await readJson(request);
    const month = parseOpsMonth(body.month);
    const branchId = typeof body.branchId === 'string' ? body.branchId.trim() : '';
    if (!branchId) throw new OpsError(422, 'Cabang wajib dipilih.');
    const targetAmount = typeof body.targetAmount === 'number' ? body.targetAmount : Number(body.targetAmount);
    if (!Number.isSafeInteger(targetAmount) || targetAmount <= 0 || targetAmount > MAX_TARGET_AMOUNT) {
      throw new OpsError(422, 'Target omzet harus berupa angka bulat lebih dari 0.');
    }

    const branch = await prisma.opsBranch.findFirst({
      where: {
        id: branchId,
        active: true,
        ...(GLOBAL_REPORT_ROLES.includes(actor.role) ? {} : { id: actor.branchId || '' }),
      },
      select: { id: true, name: true },
    });
    if (!branch) throw new OpsError(404, 'Cabang aktif tidak ditemukan pada cakupan Anda.');

    const monthDate = targetMonthDate(month);
    const target = await prisma.$transaction(async (tx) => {
      const saved = await tx.opsMonthlyRevenueTarget.upsert({
        where: { branchId_month: { branchId: branch.id, month: monthDate } },
        create: { branchId: branch.id, month: monthDate, targetAmount: new Prisma.Decimal(targetAmount), setById: actor.id },
        update: { targetAmount: new Prisma.Decimal(targetAmount), setById: actor.id },
        select: { id: true, branchId: true, month: true, targetAmount: true, updatedAt: true, branch: { select: { id: true, name: true } } },
      });
      await tx.opsAuditLog.create({
        data: {
          actorUserId: actor.id,
          branchId: branch.id,
          entityType: 'MONTHLY_REVENUE_TARGET',
          entityId: saved.id,
          action: 'UPSERT',
          afterData: { month, targetAmount },
        },
      });
      return saved;
    });

    return NextResponse.json(serialize({ target: targetView(target) }));
  } catch (error) {
    return handleOpsError(error, 'save monthly revenue target');
  }
}
