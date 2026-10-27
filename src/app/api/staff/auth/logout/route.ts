import { logoutStaff } from '@/lib/staff-auth/service';
import { assertStaffOrigin, staffError, staffResponse } from '@/lib/staff-auth/http';

export async function POST(request: Request) {
  try {
    assertStaffOrigin(request);
    await logoutStaff();
    return staffResponse({ success: true });
  } catch (error) { return staffError(error); }
}
