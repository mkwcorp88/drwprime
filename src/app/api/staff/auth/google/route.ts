import { signInGoogleStaff, setStaffSessionCookie, resolveStaffToken } from '@/lib/staff-auth/service';
import { assertStaffOrigin, staffError, staffJson, staffResponse } from '@/lib/staff-auth/http';

export async function POST(request: Request) {
  try {
    assertStaffOrigin(request);
    const body = await staffJson(request);
    const token = await signInGoogleStaff(body.credential);
    const staff = await resolveStaffToken(token);
    const response = staffResponse({ authenticated: true, needsPhone: !staff?.phone });
    setStaffSessionCookie(response, token);
    return response;
  } catch (error) { return staffError(error); }
}
