import { NextResponse } from 'next/server';
import { loginOpsStaff } from '@/lib/treatment-operations/auth';
import { handleOpsError, readJson } from '@/lib/treatment-operations/http';
import { OpsError } from '@/lib/treatment-operations/utils';

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    if (typeof body.email !== 'string' || typeof body.password !== 'string') {
      throw new OpsError(400, 'Email dan password wajib diisi.');
    }
    const staff = await loginOpsStaff(body.email, body.password);
    return NextResponse.json({
      staff: { id: staff.id, name: staff.name, role: staff.role },
      passwordChangeRequired: staff.mustChangePassword,
    });
  } catch (error) {
    return handleOpsError(error, 'login');
  }
}
