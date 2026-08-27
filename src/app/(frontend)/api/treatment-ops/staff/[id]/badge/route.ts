import { NextResponse } from 'next/server';
import { issueStaffBadge, requireOpsStaff } from '@/lib/treatment-operations/auth';
import { handleOpsError } from '@/lib/treatment-operations/http';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireOpsStaff(['SUPER_ADMIN', 'MANAGEMENT']);
    const { id } = await context.params;
    return NextResponse.json(await issueStaffBadge(actor, id));
  } catch (error) {
    return handleOpsError(error, 'issue staff badge');
  }
}
