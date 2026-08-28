import ReportPage from '@/components/treatment-ops/ReportPage';
import { REPORT_ROLES } from '@/lib/treatment-operations/constants';
import { requireOpsPage } from '@/lib/treatment-operations/page-auth';

export default async function TreatmentOpsReportPage() {
  await requireOpsPage(REPORT_ROLES);
  return <ReportPage />;
}
