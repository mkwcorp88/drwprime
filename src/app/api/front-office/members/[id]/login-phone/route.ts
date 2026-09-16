import { requireAdmin, handleAuthError, AuthError } from '@/lib/auth';
import { assertMemberOrigin, memberError, memberJson, memberResponse } from '@/lib/member-auth/http';
import { approveMemberPhoneRecovery } from '@/lib/member-auth/service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    assertMemberOrigin(request);
    const { id } = await params;
    const body = await memberJson(request);
    const result = await approveMemberPhoneRecovery(id, body.phone, body.reason, admin.clerkUserId);
    return memberResponse({ ...result, message: 'Verifikasi disetujui selama 24 jam. Member harus login dengan OTP pada nomor tersebut.' });
  } catch (error) {
    return error instanceof AuthError ? handleAuthError(error) : memberError(error);
  }
}
