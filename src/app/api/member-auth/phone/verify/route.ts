import { cookies } from 'next/headers';
import { MEMBER_SESSION_COOKIE, MEMBER_SESSION_SECONDS, OTP_BINDING_COOKIE } from '@/lib/member-auth/policy';
import { memberCookieOptions, requireMember } from '@/lib/member-auth/session';
import { assertMemberOrigin, memberError, memberJson, memberResponse } from '@/lib/member-auth/http';
import { verifyProfilePhoneOtp } from '@/lib/member-auth/service';

export async function POST(request: Request) {
  try {
    assertMemberOrigin(request);
    const member = await requireMember();
    const body = await memberJson(request);
    const binding = (await cookies()).get(OTP_BINDING_COOKIE)?.value || '';
    const result = await verifyProfilePhoneOtp(member.id, body.challengeId, body.code, binding, body.dateOfBirth);
    const response = memberResponse({ stage: result.kind });
    response.cookies.set(OTP_BINDING_COOKIE, '', memberCookieOptions(0));
    if (result.kind === 'verified') {
      response.cookies.set(MEMBER_SESSION_COOKIE, result.sessionToken, memberCookieOptions(MEMBER_SESSION_SECONDS));
    }
    return response;
  } catch (error) { return memberError(error); }
}
