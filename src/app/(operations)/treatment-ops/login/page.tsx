import { redirect } from 'next/navigation';
import InternalLogin from '@/components/treatment-ops/InternalLogin';
import { getOpsStaff } from '@/lib/treatment-operations/auth';

export default async function TreatmentOpsLoginPage() {
  const staff = await getOpsStaff();
  if (staff) redirect(staff.mustChangePassword ? '/treatment-ops/settings' : '/treatment-ops');
  return <InternalLogin />;
}
