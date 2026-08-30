import { logoutOpsStaff } from '@/lib/treatment-operations/auth';

export async function POST() {
  await logoutOpsStaff();
  // Use a relative Location so the browser stays on the current public
  // origin (admin.drwprime.com) instead of the container/proxy host.
  return new Response(null, {
    status: 303,
    headers: { Location: '/treatment-ops/login' },
  });
}
