import { cookies } from 'next/headers';
import { getMember } from '@/lib/member-auth/session';
import { memberError, memberResponse } from '@/lib/member-auth/http';
import { pendingEnrollment } from '@/lib/member-auth/service';
import { ENROLLMENT_COOKIE, OTP_BINDING_COOKIE } from '@/lib/member-auth/policy';
import { memberOtpConfigured } from '@/lib/member-auth/whatsapp';
import type { MemberClientUser } from '@/lib/member-auth/types';

export async function GET() {
  try {
    const user = await getMember();
    const jar = await cookies();
    const member: MemberClientUser | null = user ? {
      id: user.id, firstName: user.firstName, lastName: user.lastName,
      fullName: [user.firstName, user.lastName].filter(Boolean).join(' '),
      email: user.email, phone: user.loginPhone!, imageUrl: user.avatarUrl, isTeamLeader: user.isTeamLeader,
    } : null;
    const enrollment = member ? null : await pendingEnrollment(jar.get(ENROLLMENT_COOKIE)?.value, jar.get(OTP_BINDING_COOKIE)?.value);
    return memberResponse({ user: member, enrollment, otpAvailable: memberOtpConfigured() });
  } catch (error) { return memberError(error); }
}
