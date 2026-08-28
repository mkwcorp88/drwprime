import { ScanLanding } from '@/components/treatment-ops/ScanOrder';
import { requireOpsPage } from '@/lib/treatment-operations/page-auth';

export default async function ScanPage() {
  await requireOpsPage();
  return <ScanLanding />;
}
