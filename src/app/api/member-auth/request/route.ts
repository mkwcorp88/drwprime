import { cookies } from 'next/headers';
import { OTP_BINDING_COOKIE, ENROLLMENT_COOKIE } from '@/lib/member-auth/policy';
import { memberCookieOptions, newToken, validToken } from '@/lib/member-auth/session';
import { assertMemberOrigin, memberError, memberJson, memberRequestIp, memberResponse } from '@/lib/member-auth/http';
import { requestMemberOtp } from '@/lib/member-auth/service';

export async function POST(request: Request) {
  try {
    assertMemberOrigin(request);
    const body = await memberJson(request);
    const jar = await cookies();
    const existing = jar.get(OTP_BINDING_COOKIE)?.value;
    const binding = validToken(existing) ? existing : newToken();
    const result = await requestMemberOtp(body.phone, binding, memberRequestIp(request));
    const response = memberResponse(result);
    response.cookies.set(OTP_BINDING_COOKIE, binding, memberCookieOptions(1800));
    response.cookies.set(ENROLLMENT_COOKIE, '', memberCookieOptions(0));
    return response;
  } catch (error) { return memberError(error); }
}
