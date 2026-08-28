import type { Metadata } from 'next';
import TreatmentOpsShell from '@/components/treatment-ops/TreatmentOpsShell';
import { getOpsStaff } from '@/lib/treatment-operations/auth';

export const metadata: Metadata = {
  title: 'Operasional Treatment DRW Prime',
  robots: { index: false, follow: false },
};

export default async function TreatmentOpsLayout({ children }: { children: React.ReactNode }) {
  const staff = await getOpsStaff();
  const safeStaff = staff ? { name: staff.name, role: staff.role, mustChangePassword: staff.mustChangePassword } : null;
  return <TreatmentOpsShell staff={safeStaff}>{children}</TreatmentOpsShell>;
}
