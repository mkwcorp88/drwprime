'use client';

import Image from 'next/image';
import Link from 'next/link';

const QUICK_ACTIONS = [
  {
    href: '/front-office/performance',
    label: 'Performance',
    description: 'Visit & Omzet',
    icon: '/front-office-icons/performance.webp',
  },
  {
    href: '/front-office/codes',
    label: 'Kode Affiliate',
    description: 'Kelola Kode',
    icon: '/front-office-icons/affiliate.webp',
  },
  {
    href: '/front-office/report',
    label: 'Report Affiliate',
    description: 'Komisi',
    icon: '/front-office-icons/report.webp',
  },
  {
    href: '/front-office/completed-profiles',
    label: 'Membership',
    description: 'Profil Lengkap',
    icon: '/front-office-icons/membership.webp',
  },
  {
    href: '/front-office/spending-scan',
    label: 'Scan Spending',
    description: 'Input Transaksi',
    icon: '/front-office-icons/scan.webp',
  },
  {
    href: '/front-office/report-spending-daily',
    label: 'Report Spending',
    description: 'Rekap Harian',
    icon: '/front-office-icons/spending.webp',
  },
  {
    href: '/front-office/products',
    label: 'Products & Promo',
    description: 'Katalog & Promo',
    icon: '/front-office-icons/products.webp',
  },
  {
    href: '/front-office/best-deals',
    label: 'Best Deal',
    description: 'Kelola Promo',
    icon: '/front-office-icons/promo.webp',
  },
  {
    href: '/front-office/bulk-import',
    label: 'Import Member',
    description: 'Bulk Upload',
    icon: '/front-office-icons/import.webp',
  },
  {
    href: '/front-office/report-product-daily',
    label: 'Report Produk',
    description: 'Penjualan Harian',
    icon: '/front-office-icons/report.webp',
  },
  {
    href: '/front-office/blog',
    label: 'Blog',
    description: 'Konten Edukasi',
    icon: '/front-office-icons/blog.webp',
  },
] as const;

export default function QuickActions() {
  return (
    <section className="mx-auto mb-8 max-w-5xl fo-fade-up fo-stagger-1">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
        Menu Cepat
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {QUICK_ACTIONS.map((action, index) => {
          const isUnpairedMobile = QUICK_ACTIONS.length % 2 === 1 && index === QUICK_ACTIONS.length - 1;

          return (
            <Link
              key={action.href}
              href={action.href}
              className={`group fo-glass-card-soft flex min-h-[124px] flex-col items-center justify-center gap-2 rounded-xl p-4 text-center transition-all hover:border-primary/25 hover:bg-primary/[0.04] active:scale-[0.98] ${
                isUnpairedMobile
                  ? 'col-span-2 w-[calc((100%-0.75rem)/2)] justify-self-center sm:col-span-1 sm:w-full'
                  : ''
              }`}
            >
              <Image
                src={action.icon}
                alt=""
                width={56}
                height={56}
                className="h-12 w-12 rounded-xl object-cover ring-1 ring-primary/20 shadow-[0_0_18px_rgba(212,175,55,0.08)] transition-transform duration-300 group-hover:scale-105"
              />
              <div className="min-h-8">
                <p className="text-xs font-semibold leading-4 text-white/80">{action.label}</p>
                <p className="mt-0.5 text-[10px] leading-3.5 text-white/35">{action.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
