import StaffManagement from '@/components/treatment-ops/StaffManagement';
import { isOpsWhatsAppOtpEnabled } from '@/lib/treatment-operations/auth-mode';
import { requireOpsPage } from '@/lib/treatment-operations/page-auth';

export default async function TreatmentOpsStaffPage() {
  await requireOpsPage(['SUPER_ADMIN']);
  return <StaffManagement otpEnabled={isOpsWhatsAppOtpEnabled()} />;
}
