'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { OpsRole } from '@prisma/client';
import { BarChart3, FlaskConical, Gauge, IdCard, LogOut, QrCode, Settings, UserCog, WalletCards } from 'lucide-react';
import { REPORT_ROLES } from '@/lib/treatment-operations/constants';
import { OpsPwaInstall } from './OpsPwaInstall';

const links = [
  { href: '/treatment-ops', label: 'Operasional', icon: Gauge, roles: null },
  { href: '/treatment-ops/scan', label: 'Scan QR', icon: QrCode, roles: null },
  { href: '/treatment-ops/badges', label: 'Kartu', icon: IdCard, roles: ['SUPER_ADMIN', 'MANAGEMENT'] as OpsRole[] },
  { href: '/treatment-ops/report', label: 'Report', icon: BarChart3, roles: REPORT_ROLES },
  { href: '/treatment-ops/incentives', label: 'Insentif', icon: WalletCards, roles: null },
  { href: '/treatment-ops/treatments', label: 'Treatment', icon: FlaskConical, roles: ['SUPER_ADMIN'] as OpsRole[] },
  { href: '/treatment-ops/staff', label: 'Staf', icon: UserCog, roles: ['SUPER_ADMIN'] as OpsRole[] },
  { href: '/treatment-ops/settings', label: 'Pengaturan', icon: Settings, roles: null },
];

type ShellStaff = { name: string; role: OpsRole; mustChangePassword: boolean; avatarUrl: string | null };

export default function TreatmentOpsShell({ children, staff }: { children: React.ReactNode; staff: ShellStaff | null }) {
  const pathname = usePathname();
  const visibleLinks = staff
    ? links.filter((link) => (!staff.mustChangePassword || link.href === '/treatment-ops/settings') && (!link.roles || link.roles.includes(staff.role)))
    : [];
  return (
    <div className="fo-glass-page min-h-screen text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07090d]/80 shadow-[0_8px_30px_rgba(0,0,0,0.16)] backdrop-blur-2xl backdrop-saturate-150">
        <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
            <Link href="/treatment-ops" className="flex items-center gap-3">
              <img src="/drwprime-hub-logo.png" alt="DRWPRIME HUB" className="size-10 shrink-0 rounded-[0.9rem] object-cover ring-1 ring-primary/40 shadow-[0_0_20px_rgba(212,175,55,0.25)]" />
              <span className="min-w-0">
                <strong className="block truncate text-sm tracking-[0.12em]">DRWPRIME HUB</strong>
                <span className="block truncate text-[9px] uppercase tracking-[0.18em] text-primary/60">Treatment Operations</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {visibleLinks.map(({ href, label }) => {
              const activeLabel = href === '/treatment-ops/scan' && staff && staff.role !== 'SUPER_ADMIN' ? 'Barcode Saya' : label;
              const active = pathname === href || (href !== '/treatment-ops' && pathname.startsWith(href));
              return (
                <Link key={href} href={href} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${active ? 'bg-primary/15 text-primary' : 'text-white/55 hover:text-primary'}`}>
                  {activeLabel}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {staff && (
              <div className="hidden items-center gap-2 lg:flex">
                {staff.avatarUrl ? (
                  <img src={staff.avatarUrl} alt={staff.name} className="size-7 rounded-full object-cover ring-1 ring-primary/30" />
                ) : (
                  <span className="flex size-7 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-[10px] font-bold text-primary">
                    {staff.name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('')}
                  </span>
                )}
                <span className="max-w-40 truncate text-[11px] text-white/40">{staff.name}</span>
              </div>
            )}
            <Link href="https://drwprime.com" className="hidden items-center gap-1.5 text-xs font-semibold text-white/55 hover:text-primary sm:flex">
              <LogOut className="size-3.5" /> Website utama
            </Link>
            {staff && <form action="/api/treatment-ops/auth/logout" method="post">
              <button aria-label="Keluar" className="flex min-h-10 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/75 transition hover:border-primary/50 hover:text-primary">
                <LogOut className="size-3.5" /> <span className="hidden sm:inline">Keluar</span>
              </button>
            </form>}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-28 pt-4 sm:px-6 sm:pb-10 sm:pt-6"><OpsPwaInstall />{children}</main>
      <nav className="fixed inset-x-0 bottom-2 z-40 px-3 pb-[max(0.35rem,env(safe-area-inset-bottom))] md:hidden">
        <div className="mobile-tabbar mx-auto max-w-xl rounded-[1.7rem]">
          <div className="scrollbar-hide flex snap-x gap-1 overflow-x-auto px-1.5 py-1.5">
          {visibleLinks.map(({ href, label, icon: Icon }) => {
            const activeLabel = href === '/treatment-ops/scan' && staff && staff.role !== 'SUPER_ADMIN' ? 'Barcode Saya' : label;
            const active = pathname === href || (href !== '/treatment-ops' && pathname.startsWith(href));
            return (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`flex min-w-[4.8rem] snap-start flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-semibold transition ${active ? 'bg-primary/15 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]' : 'text-white/55'}`}>
                <Icon className="size-[1.15rem]" />{activeLabel}
              </Link>
            );
          })}
          </div>
        </div>
      </nav>
    </div>
  );
}
