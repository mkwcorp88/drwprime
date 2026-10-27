import { cookies } from 'next/headers';
import { requireStaff, STAFF_OTP_BINDING_COOKIE, verifyStaffPhoneOtp } from '@/lib/staff-auth/service';
import { assertStaffOrigin, staffError, staffJson, staffResponse } from '@/lib/staff-auth/http';

export async function POST(request: Request) {
  try {
    assertStaffOrigin(request);
    const staff = await requireStaff();
    const body = await staffJson(request);
    await verifyStaffPhoneOtp(staff.id, body.challengeId, body.code, (await cookies()).get(STAFF_OTP_BINDING_COOKIE)?.value || '');
    const response = staffResponse({ verified: true });
    response.cookies.delete(STAFF_OTP_BINDING_COOKIE);
    return response;
  } catch (error) { return staffError(error); }
}
