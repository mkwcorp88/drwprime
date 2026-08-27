import { redirect } from 'next/navigation';
import ReportPage from '@/components/treatment-ops/ReportPage';
import { getOpsStaff } from '@/lib/treatment-operations/auth';
import { REPORT_ROLES } from '@/lib/treatment-operations/constants';

export default async function TreatmentOpsReportPage() {
  const staff = await getOpsStaff();
  if (!staff || !REPORT_ROLES.includes(staff.role)) redirect('/treatment-ops');
  return <ReportPage />;
}
