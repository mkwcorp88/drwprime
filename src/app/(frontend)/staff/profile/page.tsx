import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import StaffProfilePhoneForm from '@/components/staff-auth/StaffProfilePhoneForm';

export default async function StaffProfilePage() {
  try { await requireAdmin(); }
  catch { redirect('/staff/sign-in?redirect_url=/staff/profile'); }
  return <StaffProfilePhoneForm />;
}
