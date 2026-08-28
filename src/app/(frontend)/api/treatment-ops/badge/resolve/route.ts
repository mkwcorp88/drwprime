import { NextResponse } from 'next/server';
import { requireOpsStaff, resolveStaffBadge } from '@/lib/treatment-operations/auth';
import { handleOpsError, readJson } from '@/lib/treatment-operations/http';
import { OpsError } from '@/lib/treatment-operations/utils';

export async function POST(request: Request) {
  try {
    await requireOpsStaff(['SUPER_ADMIN']);
    const body = await readJson(request);
    if (typeof body.badgeToken !== 'string') throw new OpsError(400, 'Token kartu staf wajib diisi.');
    const staff = await resolveStaffBadge(body.badgeToken);
    return NextResponse.json({
      staff: { id: staff.id, employeeId: staff.employeeId, name: staff.name, role: staff.role },
    });
  } catch (error) {
    return handleOpsError(error, 'resolve staff badge');
  }
}
