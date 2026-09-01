import { NextResponse } from 'next/server';
import type { OpsIncentiveStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { INCENTIVE_MANAGEMENT_ROLES } from '@/lib/treatment-operations/constants';
import { handleOpsError, readJson } from '@/lib/treatment-operations/http';
import { OpsError, serialize } from '@/lib/treatment-operations/utils';

const ALLOWED_TRANSITIONS: Record<OpsIncentiveStatus, OpsIncentiveStatus[]> = {
  PENDING: ['ELIGIBLE', 'VOID'],
  ELIGIBLE: ['VERIFIED', 'VOID'],
  VERIFIED: ['PAID', 'VOID'],
  PAID: [],
  VOID: [],
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireOpsStaff(INCENTIVE_MANAGEMENT_ROLES);
    const body = await readJson(request);
    const status = body.status as OpsIncentiveStatus;
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!['VERIFIED', 'PAID', 'VOID'].includes(status)) throw new OpsError(422, 'Status insentif tidak valid.');
    if (status === 'VOID' && !reason) throw new OpsError(422, 'Alasan pembatalan insentif wajib diisi.');

    const { id } = await params;
    const updated = await prisma.$transaction(async (tx) => {
      const entry = await tx.opsIncentiveLedger.findUnique({ where: { id } });
      if (!entry) throw new OpsError(404, 'Data insentif tidak ditemukan.');
      if (!ALLOWED_TRANSITIONS[entry.status].includes(status)) {
        throw new OpsError(409, `Status ${entry.status} tidak dapat diubah menjadi ${status}.`);
      }
      const now = new Date();
      const next = await tx.opsIncentiveLedger.update({
        where: { id },
        data: {
          status,
          ...(status === 'VERIFIED' ? { verifiedById: actor.id, verifiedAt: now, adjustmentReason: null } : {}),
          ...(status === 'PAID' ? { paidAt: now } : {}),
          ...(status === 'VOID' ? { adjustmentReason: reason } : {}),
        },
      });
      await tx.opsAuditLog.create({
        data: {
          actorUserId: actor.id,
          branchId: entry.branchId,
          entityType: 'INCENTIVE_LEDGER',
          entityId: entry.id,
          action: `STATUS_${status}`,
          beforeData: { status: entry.status },
          afterData: { status, verifiedAt: next.verifiedAt?.toISOString(), paidAt: next.paidAt?.toISOString() },
          reason: reason || null,
        },
      });
      return next;
    });
    return NextResponse.json(serialize({ entry: updated }));
  } catch (error) {
    return handleOpsError(error, 'update incentive');
  }
}
