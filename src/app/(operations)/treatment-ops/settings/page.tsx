import { redirect } from 'next/navigation';
import PasswordSettings from '@/components/treatment-ops/PasswordSettings';
import { getOpsStaff } from '@/lib/treatment-operations/auth';

export default async function TreatmentOpsSettingsPage() {
  const staff = await getOpsStaff();
  if (!staff) redirect('/treatment-ops/login');
  return <PasswordSettings staffName={staff.name} email={staff.email} forced={staff.mustChangePassword} />;
}
