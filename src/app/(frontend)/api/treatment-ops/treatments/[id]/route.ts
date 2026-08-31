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
    const incentiveType = ((item as { incentiveType?: unknown }).incentiveType ?? 'FIXED') as OpsIncentiveType;
    if (!INCENTIVE_TYPES.includes(incentiveType)) {
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
      incentiveType,
      incentiveValue: new Prisma.Decimal(incentiveValue),
    };
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireOpsStaff(['SUPER_ADMIN']);
    const { id } = await params;
    const body = await readJson(request);

    const existing = await prisma.opsTreatment.findUnique({ where: { id } });
    if (!existing) throw new OpsError(404, 'Treatment tidak ditemukan.');

    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (reason.length < 2 || reason.length > 240) {
      throw new OpsError(422, 'Alasan perubahan wajib diisi (2-240 karakter).');
    }

    const update: Prisma.OpsTreatmentUpdateInput = {};
    if (typeof body.name === 'string' && body.name.trim()) update.name = body.name.trim();
    if (typeof body.category === 'string') update.category = body.category.trim() || null;
    if (typeof body.defaultPrice === 'number' && Number.isFinite(body.defaultPrice)) {
      if (body.defaultPrice < 0) throw new OpsError(422, 'Harga default tidak valid.');
      update.defaultPrice = new Prisma.Decimal(body.defaultPrice);
    }
    if (typeof body.active === 'boolean') update.active = body.active;
    const willActive = typeof body.active === 'boolean' ? body.active : existing.active;
    const price = typeof body.defaultPrice === 'number' && Number.isFinite(body.defaultPrice)
      ? body.defaultPrice
      : Number(existing.defaultPrice);
    if (willActive && price <= 0) {
      throw new OpsError(422, 'Treatment aktif wajib memiliki harga default lebih dari 0.');
    }
    if (typeof body.code === 'string' && body.code.trim()) {
      const code = body.code.trim().toUpperCase().replace(/\s+/g, '-');
      const dup = await prisma.opsTreatment.findFirst({ where: { code, NOT: { id } } });
      if (dup) throw new OpsError(409, 'Kode treatment sudah digunakan.');
      update.code = code;
    }

    const actions = body.actions !== undefined ? parseActions(body.actions) : null;

    await prisma.$transaction(async (tx) => {
      if (actions) {
        await tx.opsTreatmentActionTemplate.deleteMany({ where: { treatmentId: id } });
        await tx.opsTreatmentActionTemplate.createMany({
          data: actions.map((action) => ({ ...action, treatmentId: id })),
        });
      }
      await tx.opsTreatment.update({ where: { id }, data: update });
      await tx.opsAuditLog.create({
        data: {
          actorUserId: actor.id,
          entityType: 'TREATMENT',
          entityId: id,
          action: 'UPDATE',
          reason,
          afterData: { name: update.name ?? existing.name, actions: actions?.length ?? undefined },
        },
      });
    });

    const fresh = await prisma.opsTreatment.findUnique({
      where: { id },
      include: { actionTemplates: { orderBy: { sequenceNumber: 'asc' } } },
    });
    return NextResponse.json(serialize({ treatment: fresh }));
  } catch (error) {
    return handleOpsError(error, 'update treatment');
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireOpsStaff(['SUPER_ADMIN']);
    const { id } = await params;
    const body = await readJson(request);
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (reason.length < 2 || reason.length > 240) {
      throw new OpsError(422, 'Alasan penghapusan wajib diisi (2-240 karakter).');
    }

    const treatment = await prisma.opsTreatment.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });
    if (!treatment) throw new OpsError(404, 'Treatment tidak ditemukan.');
    if (treatment._count.orders > 0) {
      throw new OpsError(409, 'Treatment sudah pernah digunakan pada order dan tidak dapat dihapus. Nonaktifkan treatment ini agar riwayat tetap aman.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.opsTreatmentActionTemplate.deleteMany({ where: { treatmentId: id } });
      await tx.opsTreatment.delete({ where: { id } });
      await tx.opsAuditLog.create({
        data: {
          actorUserId: actor.id,
          entityType: 'TREATMENT',
          entityId: id,
          action: 'DELETE',
          reason,
          afterData: { code: treatment.code, name: treatment.name },
        },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleOpsError(error, 'delete treatment');
  }
}
