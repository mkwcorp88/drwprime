import type { Metadata } from 'next';
import TreatmentOpsShell from '@/components/treatment-ops/TreatmentOpsShell';
import { getOpsStaff } from '@/lib/treatment-operations/auth';

export const metadata: Metadata = {
  title: 'DRWPRIME HUB',
  manifest: '/treatment-ops-manifest.json',
  applicationName: 'DRWPRIME HUB',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'DRWPRIME HUB' },
  icons: { icon: '/drwprime-hub-logo.png', apple: '/drwprime-hub-logo.png' },
  robots: { index: false, follow: false },
};

export default async function TreatmentOpsLayout({ children }: { children: React.ReactNode }) {
  const staff = await getOpsStaff();
  const safeStaff = staff ? { name: staff.name, role: staff.role, mustChangePassword: staff.mustChangePassword, avatarUrl: staff.avatarUrl } : null;
  return <TreatmentOpsShell staff={safeStaff}>{children}</TreatmentOpsShell>;
}
