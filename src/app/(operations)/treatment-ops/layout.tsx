import type { Metadata } from 'next';
import TreatmentOpsShell from '@/components/treatment-ops/TreatmentOpsShell';

export const metadata: Metadata = {
  title: 'Operasional Treatment DRW Prime',
  robots: { index: false, follow: false },
};

export default async function TreatmentOpsLayout({ children }: { children: React.ReactNode }) {
  return <TreatmentOpsShell>{children}</TreatmentOpsShell>;
}
