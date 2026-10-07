import { NextResponse } from 'next/server';
import { loginOpsStaff } from '@/lib/treatment-operations/auth';
import { isOpsLoginDisabled, isOpsWhatsAppOtpEnabled, requiresOpsPasswordChange } from '@/lib/treatment-operations/auth-mode';
import { handleOpsError, readJson } from '@/lib/treatment-operations/http';
import { resolveOpsLoginIdentifier } from '@/lib/treatment-operations/profile';
import { OpsError } from '@/lib/treatment-operations/utils';

export async function POST(request: Request) {
  try {
    if (isOpsLoginDisabled()) {
      throw new OpsError(503, 'Login sedang dinonaktifkan.', 'LOGIN_DISABLED');
    }
    const body = await readJson(request);
    if (typeof body.phone !== 'string' || typeof body.password !== 'string') {
      throw new OpsError(400, 'Nomor WhatsApp atau email lama dan password wajib diisi.');
    }

    const lookup = resolveOpsLoginIdentifier(body.phone);
    if (isOpsWhatsAppOtpEnabled() && lookup?.type !== 'legacy-email') {
      throw new OpsError(403, 'Login password sedang dinonaktifkan.', 'PASSWORD_LOGIN_DISABLED');
    }

    const staff = await loginOpsStaff(body.phone, body.password);
    return NextResponse.json({
      staff: { id: staff.id, name: staff.name, role: staff.role },
      passwordChangeRequired: requiresOpsPasswordChange(staff),
      phoneRegistrationRequired: !staff.phone,
    });
  } catch (error) {
    return handleOpsError(error, 'login');
  }
}
