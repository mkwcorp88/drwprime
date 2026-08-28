'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { OpsRole } from '@prisma/client';
import { BarChart3, ClipboardPlus, FlaskConical, Gauge, IdCard, LogOut, QrCode, Settings, UserCog, WalletCards } from 'lucide-react';
import { REPORT_ROLES } from '@/lib/treatment-operations/constants';

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
      <header className="sticky top-0 z-40 border-b border-primary/20 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/treatment-ops" className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary shadow-[0_0_20px_rgba(212,175,55,0.25)]">
              <ClipboardPlus className="size-5" />
            </span>
            <span>
              <strong className="block text-sm tracking-[0.12em]">DRW PRIME</strong>
              <span className="block text-[10px] uppercase tracking-[0.2em] text-primary/60">Treatment Flow</span>
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

          <div className="flex items-center gap-3">
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
              <button className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/75 transition hover:border-primary/50 hover:text-primary">
                <LogOut className="size-3.5" /> Keluar
              </button>
            </form>}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 sm:pb-10">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-primary/20 bg-black/70 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-xl gap-1 overflow-x-auto">
          {visibleLinks.map(({ href, label, icon: Icon }) => {
            const activeLabel = href === '/treatment-ops/scan' && staff && staff.role !== 'SUPER_ADMIN' ? 'Barcode Saya' : label;
            const active = pathname === href || (href !== '/treatment-ops' && pathname.startsWith(href));
            return (
              <Link key={href} href={href} className={`flex min-w-[4.4rem] flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold transition ${active ? 'bg-primary/15 text-primary' : 'text-white/55'}`}>
                <Icon className="size-5" />{activeLabel}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
