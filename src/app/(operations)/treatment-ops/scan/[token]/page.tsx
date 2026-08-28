import { ScannedOrder } from '@/components/treatment-ops/ScanOrder';
import { requireOpsPage } from '@/lib/treatment-operations/page-auth';

export default async function ScannedOrderPage({ params }: { params: Promise<{ token: string }> }) {
  await requireOpsPage(['SUPER_ADMIN']);
  const { token } = await params;
  return <ScannedOrder token={token} />;
}
