import { redirect } from 'next/navigation';
import InternalLogin from '@/components/treatment-ops/InternalLogin';
import WhatsAppOtpLogin from '@/components/treatment-ops/WhatsAppOtpLogin';
import { getOpsStaff } from '@/lib/treatment-operations/auth';
import { isOpsWhatsAppOtpEnabled, requiresOpsPasswordChange } from '@/lib/treatment-operations/auth-mode';

export default async function TreatmentOpsLoginPage() {
  const staff = await getOpsStaff();
  if (staff) redirect(requiresOpsPasswordChange(staff) ? '/treatment-ops/settings' : '/treatment-ops');
  return isOpsWhatsAppOtpEnabled() ? <WhatsAppOtpLogin /> : <InternalLogin />;
}
