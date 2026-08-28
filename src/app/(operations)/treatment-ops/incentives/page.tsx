import IncentiveReport from '@/components/treatment-ops/IncentiveReport';
import { requireOpsPage } from '@/lib/treatment-operations/page-auth';

export default async function IncentivesPage() {
  await requireOpsPage();
  return <IncentiveReport />;
}
