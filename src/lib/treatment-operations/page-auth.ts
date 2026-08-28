import type { OpsRole } from '@prisma/client';
import { redirect } from 'next/navigation';
import { getOpsStaff } from './auth';

export async function requireOpsPage(allowedRoles?: readonly OpsRole[]) {
  const staff = await getOpsStaff();
  if (!staff) redirect('/treatment-ops/login');
  if (staff.mustChangePassword) redirect('/treatment-ops/settings');
  if (allowedRoles && !allowedRoles.includes(staff.role)) redirect('/treatment-ops');
  return staff;
}
