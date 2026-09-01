import OperationsDashboard from '@/components/treatment-ops/OperationsDashboard';
import { requireOpsPage } from '@/lib/treatment-operations/page-auth';
import { redirect } from 'next/navigation';

export default async function TreatmentOperationsPage() {
  const staff = await requireOpsPage();
  if (staff.role === 'FINANCE') redirect('/treatment-ops/incentives');
  return <OperationsDashboard />;
}
