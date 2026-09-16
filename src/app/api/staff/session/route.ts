import { requireAdmin, AuthError } from '@/lib/auth';
import { memberResponse } from '@/lib/member-auth/http';

export async function GET() {
  try {
    await requireAdmin();
    return memberResponse({ isAdmin: true });
  } catch (error) {
    return memberResponse({ isAdmin: false }, error instanceof AuthError ? 200 : 503);
  }
}
