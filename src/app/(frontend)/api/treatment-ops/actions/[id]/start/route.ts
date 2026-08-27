import { NextResponse } from 'next/server';
import { requireOpsStaff, resolveStaffBadge } from '@/lib/treatment-operations/auth';
import { handleOpsError, readJson } from '@/lib/treatment-operations/http';
import { startAction } from '@/lib/treatment-operations/order-service';
import { OpsError } from '@/lib/treatment-operations/utils';

const KIOSK_ROLES = ['SUPER_ADMIN', 'MANAGEMENT', 'FRONT_OFFICE', 'SUPERVISOR'] as const;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireOpsStaff();
    const { id } = await context.params;
    const body = await readJson(request);

    let performer;
    if (typeof body.badgeToken === 'string' && body.badgeToken.trim()) {
      if (!KIOSK_ROLES.includes(actor.role as (typeof KIOSK_ROLES)[number])) {
        throw new OpsError(403, 'Role Anda tidak dapat memindai kartu terapis untuk tindakan ini.');
      }
      performer = await resolveStaffBadge(body.badgeToken, ['THERAPIST']);
    } else {
      if (actor.role !== 'THERAPIST') throw new OpsError(403, 'Terapis harus login sendiri atau gunakan scan kartu terapis.');
      performer = actor;
    }

    return NextResponse.json({ action: await startAction(performer, id) });
  } catch (error) {
    return handleOpsError(error, 'start action');
  }
}
