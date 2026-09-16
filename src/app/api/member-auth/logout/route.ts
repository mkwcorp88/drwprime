import { ENROLLMENT_COOKIE, OTP_BINDING_COOKIE } from '@/lib/member-auth/policy';
import { logoutMember, memberCookieOptions } from '@/lib/member-auth/session';
import { tokenHash, validToken } from '@/lib/member-auth/session';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { assertMemberOrigin, memberError, memberResponse } from '@/lib/member-auth/http';

export async function POST(request: Request) {
  try {
    assertMemberOrigin(request);
    const binding = (await cookies()).get(OTP_BINDING_COOKIE)?.value;
    if (validToken(binding)) {
      await prisma.memberLoginOtp.updateMany({ where: { bindingHash: tokenHash(binding) }, data: { consumedAt: new Date(), grantHash: null } });
    }
    await logoutMember();
    const response = memberResponse({ success: true });
    response.cookies.set(ENROLLMENT_COOKIE, '', memberCookieOptions(0));
    response.cookies.set(OTP_BINDING_COOKIE, '', memberCookieOptions(0));
    return response;
  } catch (error) { return memberError(error); }
}
