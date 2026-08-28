import TreatmentManagement from '@/components/treatment-ops/TreatmentManagement';
import { requireOpsPage } from '@/lib/treatment-operations/page-auth';

export default async function TreatmentOpsTreatmentsPage() {
  await requireOpsPage(['SUPER_ADMIN']);
  return <TreatmentManagement />;
}
