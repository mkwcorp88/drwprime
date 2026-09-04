import StaffDayOffDashboard from '@/components/treatment-ops/StaffDayOffDashboard';
import { requireOpsPage } from '@/lib/treatment-operations/page-auth';

export default async function TreatmentOpsDayOffPage() {
  await requireOpsPage();
  return <StaffDayOffDashboard />;
}
