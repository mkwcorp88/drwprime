import { ScannedOrder } from '@/components/treatment-ops/ScanOrder';

export default async function ScannedOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ScannedOrder token={token} />;
}
