import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getMember } from '@/lib/member-auth/session';

export const metadata: Metadata = {
  title: 'Affiliate Dashboard',
  robots: { index: false, follow: false },
};

export default async function AffiliateDashboardLayout({ children }: { children: React.ReactNode }) {
  if (!(await getMember())) redirect('/sign-in?redirect_url=/affiliate-dashboard');
  return children;
}
