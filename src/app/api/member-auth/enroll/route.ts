import { cookies } from 'next/headers';
import { ENROLLMENT_COOKIE, MEMBER_SESSION_COOKIE, MEMBER_SESSION_SECONDS, OTP_BINDING_COOKIE } from '@/lib/member-auth/policy';
import { memberCookieOptions } from '@/lib/member-auth/session';
import { assertMemberOrigin, memberError, memberJson, memberResponse } from '@/lib/member-auth/http';
import { enrollMember } from '@/lib/member-auth/service';

export async function POST(request: Request) {
  try {
    assertMemberOrigin(request);
    const body = await memberJson(request);
    const jar = await cookies();
    const token = await enrollMember(jar.get(ENROLLMENT_COOKIE)?.value || '', jar.get(OTP_BINDING_COOKIE)?.value || '', body);
    const response = memberResponse({ stage: 'done' });
    response.cookies.set(MEMBER_SESSION_COOKIE, token, memberCookieOptions(MEMBER_SESSION_SECONDS));
    response.cookies.set(ENROLLMENT_COOKIE, '', memberCookieOptions(0));
    response.cookies.set(OTP_BINDING_COOKIE, '', memberCookieOptions(0));
    return response;
  } catch (error) { return memberError(error); }
}
