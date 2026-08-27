import { redirect } from 'next/navigation';
import InternalLogin from '@/components/treatment-ops/InternalLogin';
import { getOpsStaff } from '@/lib/treatment-operations/auth';

export default async function TreatmentOpsLoginPage() {
  if (await getOpsStaff()) redirect('/treatment-ops');
  return <InternalLogin />;
}
