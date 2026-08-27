import { redirect } from 'next/navigation';
import BadgeManagement from '@/components/treatment-ops/BadgeManagement';
import { getOpsStaff } from '@/lib/treatment-operations/auth';

export default async function BadgeManagementPage() {
  const staff = await getOpsStaff();
  if (!staff || !['SUPER_ADMIN', 'MANAGEMENT'].includes(staff.role)) redirect('/treatment-ops');
  return <BadgeManagement />;
}
