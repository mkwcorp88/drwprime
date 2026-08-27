import { NextResponse } from 'next/server';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { handleOpsError, readJson } from '@/lib/treatment-operations/http';
import { assignAction } from '@/lib/treatment-operations/order-service';
import { OpsError } from '@/lib/treatment-operations/utils';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireOpsStaff(['SUPER_ADMIN', 'SUPERVISOR']);
    const { id } = await context.params;
    const body = await readJson(request);
    if (typeof body.therapistId !== 'string') throw new OpsError(400, 'Terapis wajib dipilih.');
    const action = await assignAction(actor, id, body.therapistId, typeof body.reason === 'string' ? body.reason : undefined);
    return NextResponse.json({ action });
  } catch (error) {
    return handleOpsError(error, 'assign action');
  }
}
