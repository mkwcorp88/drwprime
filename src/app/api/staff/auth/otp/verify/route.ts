import { cookies } from 'next/headers';
import { STAFF_OTP_BINDING_COOKIE, verifyStaffOtp, setStaffSessionCookie } from '@/lib/staff-auth/service';
import { assertStaffOrigin, staffError, staffJson, staffResponse } from '@/lib/staff-auth/http';

export async function POST(request: Request) {
  try {
    assertStaffOrigin(request);
    const body = await staffJson(request);
    const token = await verifyStaffOtp(body.challengeId, body.code, (await cookies()).get(STAFF_OTP_BINDING_COOKIE)?.value || '');
    const response = staffResponse({ authenticated: true });
    setStaffSessionCookie(response, token);
    response.cookies.delete(STAFF_OTP_BINDING_COOKIE);
    return response;
  } catch (error) { return staffError(error); }
}
