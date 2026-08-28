import { ScanLanding } from '@/components/treatment-ops/ScanOrder';
import StaffBadgeCard from '@/components/treatment-ops/StaffBadgeCard';
import { requireOpsPage } from '@/lib/treatment-operations/page-auth';

export default async function ScanPage() {
  const staff = await requireOpsPage();
  if (staff.role === 'SUPER_ADMIN') return <ScanLanding />;
  return <StaffBadgeCard />;
}
