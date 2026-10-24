import { cookies } from 'next/headers';
import { ENROLLMENT_COOKIE, OTP_BINDING_COOKIE, MemberAuthError } from '@/lib/member-auth/policy';
import { memberCookieOptions, newToken, requireMember, validToken } from '@/lib/member-auth/session';
import { assertMemberOrigin, memberError, memberJson, memberRequestIp, memberResponse } from '@/lib/member-auth/http';
import { requestMemberOtp } from '@/lib/member-auth/service';

export async function POST(request: Request) {
  try {
    assertMemberOrigin(request);
    const member = await requireMember();
    if (member.loginPhoneVerifiedAt) throw new MemberAuthError(409, 'Nomor login sudah terverifikasi. Hubungi Front Office untuk menggantinya.', 'PHONE_ALREADY_VERIFIED');
    const body = await memberJson(request);
    const jar = await cookies();
    const existing = jar.get(OTP_BINDING_COOKIE)?.value;
    const binding = validToken(existing) ? existing : newToken();
    const result = await requestMemberOtp(body.phone, binding, memberRequestIp(request), member.id);
    const response = memberResponse(result);
    response.cookies.set(OTP_BINDING_COOKIE, binding, memberCookieOptions(1800));
    response.cookies.set(ENROLLMENT_COOKIE, '', memberCookieOptions(0));
    return response;
  } catch (error) { return memberError(error); }
}
