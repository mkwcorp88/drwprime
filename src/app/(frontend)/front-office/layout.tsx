import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isUserAdmin } from '@/lib/admin';
import FrontOfficeShell from '@/components/FrontOfficeShell';

export const metadata: Metadata = {
  title: 'Front Office',
  robots: { index: false, follow: false },
};

export default async function FrontOfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAdmin = await isUserAdmin();
  if (!isAdmin) {
    redirect('/');
  }
  return <FrontOfficeShell>{children}</FrontOfficeShell>;
}
