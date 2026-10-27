import { getStaff } from '@/lib/staff-auth/service';
import { staffResponse } from '@/lib/staff-auth/http';

export async function GET() {
  try {
    const staff = await getStaff();
    return staffResponse({ isAdmin: Boolean(staff), staff: staff ? { name: staff.name, email: staff.email, phone: staff.phone, cmsAccess: staff.cmsAccess } : null });
  } catch { return staffResponse({ isAdmin: false, staff: null }, 503); }
}
