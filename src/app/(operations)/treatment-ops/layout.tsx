import type { Metadata } from 'next';
import TreatmentOpsShell from '@/components/treatment-ops/TreatmentOpsShell';
import { getOpsStaff } from '@/lib/treatment-operations/auth';

export const metadata: Metadata = {
  title: 'Treatment Flow DRW Prime',
  manifest: '/treatment-ops-manifest.json',
  applicationName: 'DRW Prime Treatment Flow',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Treatment Flow' },
  icons: { apple: '/apple-touch-icon-180.png' },
  robots: { index: false, follow: false },
};

export default async function TreatmentOpsLayout({ children }: { children: React.ReactNode }) {
  const staff = await getOpsStaff();
  const safeStaff = staff ? { name: staff.name, role: staff.role, mustChangePassword: staff.mustChangePassword, avatarUrl: staff.avatarUrl } : null;
  return <TreatmentOpsShell staff={safeStaff}>{children}</TreatmentOpsShell>;
}
