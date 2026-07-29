import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Pembayaran',
  description: 'Halaman pembayaran DRW Prime',
  path: '/payment',
});

export default function PaymentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
