'use client';

import Link from 'next/link';
import {
  BadgePercent,
  ChartColumnIncreasing,
  ChartNoAxesCombined,
  FileChartColumn,
  IdCard,
  Newspaper,
  PackageSearch,
  ReceiptText,
  ScanBarcode,
  Tag,
  UserRoundPlus,
  type LucideIcon,
} from 'lucide-react';

type QuickAction = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

const QUICK_ACTIONS = [
  {
    href: '/front-office/performance',
    label: 'Performance',
    description: 'Visit & Omzet',
    icon: ChartNoAxesCombined,
  },
  {
    href: '/front-office/codes',
    label: 'Kode Affiliate',
    description: 'Kelola Kode',
    icon: Tag,
  },
  {
    href: '/front-office/report',
    label: 'Report Affiliate',
    description: 'Komisi',
    icon: FileChartColumn,
  },
  {
    href: '/front-office/completed-profiles',
    label: 'Membership',
    description: 'Profil Lengkap',
    icon: IdCard,
  },
  {
    href: '/front-office/spending-scan',
    label: 'Scan Spending',
    description: 'Input Transaksi',
    icon: ScanBarcode,
  },
  {
    href: '/front-office/report-spending-daily',
    label: 'Report Spending',
    description: 'Rekap Harian',
    icon: ReceiptText,
  },
  {
    href: '/front-office/products',
    label: 'Products & Promo',
    description: 'Katalog & Promo',
    icon: PackageSearch,
  },
  {
    href: '/front-office/best-deals',
    label: 'Best Deal',
    description: 'Kelola Promo',
    icon: BadgePercent,
  },
  {
    href: '/front-office/bulk-import',
    label: 'Import Member',
    description: 'Bulk Upload',
    icon: UserRoundPlus,
  },
  {
    href: '/front-office/report-product-daily',
    label: 'Report Produk',
    description: 'Penjualan Harian',
    icon: ChartColumnIncreasing,
  },
  {
    href: '/front-office/blog',
    label: 'Blog',
    description: 'Konten Edukasi',
    icon: Newspaper,
  },
] as const satisfies readonly QuickAction[];

export default function QuickActions() {
  return (
    <section className="mx-auto mb-8 max-w-5xl fo-fade-up fo-stagger-1">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
        Menu Cepat
      </p>
      <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3">
        {QUICK_ACTIONS.map((action, index) => {
          const isUnpairedMobile = QUICK_ACTIONS.length % 2 === 1 && index === QUICK_ACTIONS.length - 1;
          const Icon = action.icon;

          return (
            <Link
              key={action.href}
              href={action.href}
              className={`group fo-glass-card-soft flex min-h-[120px] flex-col items-center justify-center gap-2.5 rounded-xl p-4 text-center transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/[0.045] hover:shadow-[0_14px_30px_rgba(0,0,0,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 active:translate-y-0 active:scale-[0.985] ${
                isUnpairedMobile
                  ? 'col-span-2 w-[calc(50%_-_0.375rem)] justify-self-center sm:col-span-1 sm:w-full'
                  : ''
              }`}
            >
              <span className="relative isolate flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[13px] border border-[#d7b554]/35 bg-[linear-gradient(145deg,rgba(27,23,13,0.96),rgba(3,3,3,0.98))] text-[#d9b75b] shadow-[inset_0_1px_0_rgba(255,238,177,0.12),0_0_0_1px_rgba(0,0,0,0.55),0_8px_20px_rgba(0,0,0,0.26),0_0_18px_rgba(212,175,55,0.06)] transition-[transform,border-color,color,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:border-[#e0bf64]/55 group-hover:text-[#ebcb72] group-hover:shadow-[inset_0_1px_0_rgba(255,242,188,0.18),0_0_0_1px_rgba(0,0,0,0.5),0_10px_24px_rgba(0,0,0,0.3),0_0_22px_rgba(212,175,55,0.12)]">
                <span className="absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-[#f4d985]/45 to-transparent" />
                <Icon
                  aria-hidden="true"
                  strokeWidth={1.65}
                  className="relative z-10 size-[23px] [filter:drop-shadow(0_0_5px_rgba(212,175,55,0.18))]"
                />
              </span>
              <div className="flex min-h-8 flex-col items-center justify-start">
                <p className="text-xs font-semibold leading-4 text-white/85 transition-colors group-hover:text-white/95">{action.label}</p>
                <p className="mt-0.5 text-[10px] leading-3.5 text-white/35">{action.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
