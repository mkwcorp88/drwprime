import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Marketing Dashboard | Derma Rich Wellness',
  description: 'Dashboard progres digital marketing Derma Rich Wellness.',
  robots: { index: false, follow: false },
};

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  try { await requireAdmin(); }
  catch { redirect('/staff/sign-in?redirect_url=/marketing'); }
  return <div className="min-h-screen bg-dark text-white">{children}</div>;
}
