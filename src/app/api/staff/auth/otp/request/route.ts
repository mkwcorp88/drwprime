import { cookies } from 'next/headers';
import { newToken, validToken } from '@/lib/member-auth/session';
import { STAFF_OTP_BINDING_COOKIE, requestStaffOtp, setStaffBindingCookie } from '@/lib/staff-auth/service';
import { assertStaffOrigin, staffError, staffJson, staffRequestIp, staffResponse } from '@/lib/staff-auth/http';

export async function POST(request: Request) {
  try {
    assertStaffOrigin(request);
    const body = await staffJson(request);
    const existing = (await cookies()).get(STAFF_OTP_BINDING_COOKIE)?.value;
    const binding = validToken(existing) ? existing : newToken();
    const result = await requestStaffOtp(body.phone, binding, staffRequestIp(request));
    const response = staffResponse(result);
    setStaffBindingCookie(response, binding);
    return response;
  } catch (error) { return staffError(error); }
}
