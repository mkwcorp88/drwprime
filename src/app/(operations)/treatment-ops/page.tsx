import OperationsDashboard from '@/components/treatment-ops/OperationsDashboard';
import { requireOpsPage } from '@/lib/treatment-operations/page-auth';

export default async function TreatmentOperationsPage() {
  await requireOpsPage();
  return <OperationsDashboard />;
}
