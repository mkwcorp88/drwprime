import { NextResponse } from 'next/server';
import { handleOpsError, readJson } from '@/lib/treatment-operations/http';
import { isOpsLoginDisabled } from '@/lib/treatment-operations/auth-mode';
import { verifyOpsLoginOtp } from '@/lib/treatment-operations/otp';
import { OpsError } from '@/lib/treatment-operations/utils';

export async function POST(request: Request) {
  try {
    if (isOpsLoginDisabled()) {
      throw new OpsError(503, 'Login sedang dinonaktifkan.', 'LOGIN_DISABLED');
    }
    const body = await readJson(request);
    if (typeof body.challengeId !== 'string' || typeof body.code !== 'string') {
      throw new OpsError(400, 'Kode OTP wajib diisi.');
    }

    const staff = await verifyOpsLoginOtp(body.challengeId, body.code);
    return NextResponse.json({
      staff: { id: staff.id, name: staff.name, role: staff.role },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const response = handleOpsError(error, 'verify login OTP');
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
}
