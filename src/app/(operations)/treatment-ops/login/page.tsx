import { redirect } from 'next/navigation';
import InternalLogin from '@/components/treatment-ops/InternalLogin';
import WhatsAppOtpLogin from '@/components/treatment-ops/WhatsAppOtpLogin';
import OpsLoginMaintenance from '@/components/treatment-ops/OpsLoginMaintenance';
import { getOpsStaff } from '@/lib/treatment-operations/auth';
import { isOpsLoginDisabled, isOpsWhatsAppOtpEnabled, requiresOpsPasswordChange } from '@/lib/treatment-operations/auth-mode';

export default async function TreatmentOpsLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ legacy?: string }>;
}) {
  const staff = await getOpsStaff();
  if (staff) redirect(requiresOpsPasswordChange(staff) ? '/treatment-ops/settings' : '/treatment-ops');
  if (isOpsLoginDisabled()) return <OpsLoginMaintenance />;
  if (isOpsWhatsAppOtpEnabled()) {
    const { legacy } = await searchParams;
    return legacy === '1' ? <InternalLogin legacyEmailOnly /> : <WhatsAppOtpLogin />;
  }
  return <InternalLogin />;
}
