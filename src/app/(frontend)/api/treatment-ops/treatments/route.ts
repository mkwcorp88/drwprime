import { NextResponse } from 'next/server';
import { Prisma, type OpsIncentiveType, type OpsRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { handleOpsError, readJson } from '@/lib/treatment-operations/http';
import { OpsError, serialize } from '@/lib/treatment-operations/utils';

const INCENTIVE_TYPES: OpsIncentiveType[] = ['FIXED', 'PERCENTAGE', 'POINTS', 'NONE'];
const EXECUTOR_ROLES: OpsRole[] = ['THERAPIST', 'DOCTOR', 'PERAWAT'];

function parseActions(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new OpsError(422, 'Treatment harus memiliki minimal satu tahapan tindakan.');
  }
  return value.map((item, index) => {
    if (typeof item !== 'object' || item === null || typeof (item as { actionName?: unknown }).actionName !== 'string') {
      throw new OpsError(422, `Tahapan ke-${index + 1}: nama tindakan wajib diisi.`);
    }
    const actionName = (item as { actionName: string }).actionName.trim();
    if (!actionName || actionName.length > 120) throw new OpsError(422, `Tahapan ke-${index + 1}: nama tindakan tidak valid.`);

    const sequenceNumber = typeof (item as { sequenceNumber?: unknown }).sequenceNumber === 'number'
      ? Math.round((item as { sequenceNumber: number }).sequenceNumber)
      : index + 1;
    const isRequired = typeof (item as { isRequired?: unknown }).isRequired === 'boolean'
      ? (item as { isRequired: boolean }).isRequired
      : true;
    const rawRole = (item as { requiredRole?: unknown }).requiredRole;
    const requiredRole: OpsRole | null = rawRole == null ? null : (rawRole as OpsRole);
    if (requiredRole !== null && !EXECUTOR_ROLES.includes(requiredRole)) {
      throw new OpsError(422, `Tahapan ke-${index + 1}: role eksekutor tidak valid.`);
    }
    const estimatedDurationMinutes = typeof (item as { estimatedDurationMinutes?: unknown }).estimatedDurationMinutes === 'number'
      ? Math.round((item as { estimatedDurationMinutes: number }).estimatedDurationMinutes)
      : null;
    const incentiveType = (item as { incentiveType?: unknown }).incentiveType ?? 'FIXED';
    if (!INCENTIVE_TYPES.includes(incentiveType as OpsIncentiveType)) {
      throw new OpsError(422, `Tahapan ke-${index + 1}: tipe insentif tidak valid.`);
    }
    const incentiveValue = Number((item as { incentiveValue?: unknown }).incentiveValue ?? 0);
    if (!Number.isFinite(incentiveValue) || incentiveValue < 0) {
      throw new OpsError(422, `Tahapan ke-${index + 1}: nilai insentif tidak valid.`);
    }

    return {
      actionName,
      sequenceNumber,
      isRequired,
      requiredRole,
      estimatedDurationMinutes,
      incentiveType: incentiveType as OpsIncentiveType,
      incentiveValue: new Prisma.Decimal(incentiveValue),
    };
  });
}

export async function GET() {
  try {
    await requireOpsStaff(['SUPER_ADMIN']);
    const treatments = await prisma.opsTreatment.findMany({
      include: { actionTemplates: { orderBy: { sequenceNumber: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(serialize({ treatments }));
  } catch (error) {
    return handleOpsError(error, 'list treatments');
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireOpsStaff(['SUPER_ADMIN']);
    const body = await readJson(request);
    if (typeof body.code !== 'string' || typeof body.name !== 'string') {
      throw new OpsError(400, 'Kode dan nama treatment wajib diisi.');
    }
    const code = body.code.trim().toUpperCase().replace(/\s+/g, '-');
    const name = body.name.trim();
    if (!code || code.length > 30) throw new OpsError(422, 'Kode treatment tidak valid.');
    if (name.length < 2 || name.length > 120) throw new OpsError(422, 'Nama treatment tidak valid.');
    const defaultPrice = Number(body.defaultPrice ?? 0);
    if (!Number.isFinite(defaultPrice) || defaultPrice < 0) throw new OpsError(422, 'Harga default tidak valid.');
    const active = typeof body.active === 'boolean' ? body.active : true;
    if (active && defaultPrice <= 0) {
      throw new OpsError(422, 'Treatment aktif wajib memiliki harga default lebih dari 0.');
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (reason.length < 2 || reason.length > 240) {
      throw new OpsError(422, 'Alasan perubahan wajib diisi (2-240 karakter).');
    }
    const actions = parseActions(body.actions);

    const existing = await prisma.opsTreatment.findUnique({ where: { code } });
    if (existing) throw new OpsError(409, 'Kode treatment sudah digunakan.');

    const treatment = await prisma.$transaction(async (tx) => {
      const created = await tx.opsTreatment.create({
        data: {
          code,
          name,
          category: typeof body.category === 'string' && body.category.trim() ? body.category.trim() : null,
          defaultPrice: new Prisma.Decimal(defaultPrice),
          active,
          actionTemplates: { create: actions },
        },
      });
      await tx.opsAuditLog.create({
        data: {
          actorUserId: actor.id,
          entityType: 'TREATMENT',
          entityId: created.id,
          action: 'CREATE',
          reason,
          afterData: { code, name, actions: actions.length },
        },
      });
      return created;
    });

    return NextResponse.json(serialize({ treatment }), { status: 201 });
  } catch (error) {
    return handleOpsError(error, 'create treatment');
  }
}
