import { cookies } from 'next/headers';
import { ENROLLMENT_COOKIE, ENROLLMENT_TTL_SECONDS, MEMBER_SESSION_COOKIE, MEMBER_SESSION_SECONDS, OTP_BINDING_COOKIE } from '@/lib/member-auth/policy';
import { memberCookieOptions } from '@/lib/member-auth/session';
import { assertMemberOrigin, memberError, memberJson, memberResponse } from '@/lib/member-auth/http';
import { verifyMemberOtp } from '@/lib/member-auth/service';

export async function POST(request: Request) {
  try {
    assertMemberOrigin(request);
    const body = await memberJson(request);
    const binding = (await cookies()).get(OTP_BINDING_COOKIE)?.value || '';
    const result = await verifyMemberOtp(body.challengeId, body.code, binding);
    if (result.kind === 'session') {
      const response = memberResponse({ stage: 'done' });
      response.cookies.set(MEMBER_SESSION_COOKIE, result.sessionToken, memberCookieOptions(MEMBER_SESSION_SECONDS));
      response.cookies.set(ENROLLMENT_COOKIE, '', memberCookieOptions(0));
      return response;
    }
    if (result.kind === 'enroll') {
      const response = memberResponse({ stage: result.stage, phone: result.phone });
      response.cookies.set(ENROLLMENT_COOKIE, result.grantToken, memberCookieOptions(ENROLLMENT_TTL_SECONDS));
      return response;
    }
    const response = memberResponse({ stage: 'support' });
    response.cookies.set(ENROLLMENT_COOKIE, '', memberCookieOptions(0));
    return response;
  } catch (error) { return memberError(error); }
}
