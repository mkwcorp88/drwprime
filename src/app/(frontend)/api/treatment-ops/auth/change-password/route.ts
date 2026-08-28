import { NextResponse } from 'next/server';
import { changeOpsStaffPassword, getOpsStaff } from '@/lib/treatment-operations/auth';
import { handleOpsError, readJson } from '@/lib/treatment-operations/http';
import { OpsError } from '@/lib/treatment-operations/utils';

export async function POST(request: Request) {
  try {
    const staff = await getOpsStaff();
    if (!staff) throw new OpsError(401, 'Silakan masuk dengan akun operasional.', 'AUTH_REQUIRED');

    const body = await readJson(request);
    if (typeof body.currentPassword !== 'string' || typeof body.newPassword !== 'string') {
      throw new OpsError(400, 'Password saat ini dan password baru wajib diisi.');
    }

    await changeOpsStaffPassword(staff, body.currentPassword, body.newPassword);
    return NextResponse.json(
      { ok: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return handleOpsError(error, 'change password');
  }
}
