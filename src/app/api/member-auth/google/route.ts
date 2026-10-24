import { memberCookieOptions } from '@/lib/member-auth/session';
import { signInGoogleMember, verifyGoogleCredential } from '@/lib/member-auth/google';
import { MEMBER_SESSION_COOKIE, MEMBER_SESSION_SECONDS, MemberAuthError } from '@/lib/member-auth/policy';
import { assertMemberOrigin, memberError, memberJson, memberResponse } from '@/lib/member-auth/http';

export async function POST(request: Request) {
  try {
    assertMemberOrigin(request);
    const { action, credential, referralCode } = await memberJson(request);
    if (action !== 'exchange') {
      throw new MemberAuthError(400, 'Tindakan tidak valid.', 'GOOGLE_ACTION_INVALID');
    }
    const identity = await verifyGoogleCredential(credential);
    const { token, phoneVerified } = await signInGoogleMember(identity, referralCode);
    const response = memberResponse({ authenticated: true, phoneVerified });
    response.cookies.set(MEMBER_SESSION_COOKIE, token, memberCookieOptions(MEMBER_SESSION_SECONDS));
    return response;
  } catch (error) { return memberError(error); }
}
