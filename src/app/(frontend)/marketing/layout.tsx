import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Marketing Dashboard | Derma Rich Wellness',
  description: 'Dashboard progres digital marketing Derma Rich Wellness.',
  robots: { index: false, follow: false },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-dark text-white">{children}</div>;
}
