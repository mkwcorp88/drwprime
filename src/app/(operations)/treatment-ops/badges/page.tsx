import BadgeManagement from '@/components/treatment-ops/BadgeManagement';
import { requireOpsPage } from '@/lib/treatment-operations/page-auth';

export default async function BadgeManagementPage() {
  await requireOpsPage(['SUPER_ADMIN', 'MANAGEMENT']);
  return <BadgeManagement />;
}
