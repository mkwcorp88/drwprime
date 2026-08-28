import StaffManagement from '@/components/treatment-ops/StaffManagement';
import { requireOpsPage } from '@/lib/treatment-operations/page-auth';

export default async function TreatmentOpsStaffPage() {
  await requireOpsPage(['SUPER_ADMIN']);
  return <StaffManagement />;
}
