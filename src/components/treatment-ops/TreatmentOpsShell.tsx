'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, ClipboardPlus, Gauge, IdCard, LogOut, QrCode, WalletCards } from 'lucide-react';

const links = [
  { href: '/treatment-ops', label: 'Operasional', icon: Gauge },
  { href: '/treatment-ops/scan', label: 'Scan QR', icon: QrCode },
  { href: '/treatment-ops/badges', label: 'Kartu', icon: IdCard },
  { href: '/treatment-ops/report', label: 'Report', icon: BarChart3 },
  { href: '/treatment-ops/incentives', label: 'Insentif', icon: WalletCards },
];

export default function TreatmentOpsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
            {links.map(({ href, label }) => {
              const active = pathname === href || (href !== '/treatment-ops' && pathname.startsWith(href));
              return (
                <Link key={href} href={href} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${active ? 'bg-primary/15 text-primary' : 'text-white/55 hover:text-primary'}`}>
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/" className="hidden items-center gap-1.5 text-xs font-semibold text-white/55 hover:text-primary sm:flex">
              <LogOut className="size-3.5" /> Website utama
            </Link>
            <form action="/api/treatment-ops/auth/logout" method="post">
              <button className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/75 transition hover:border-primary/50 hover:text-primary">
                <LogOut className="size-3.5" /> Keluar
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 sm:pb-10">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-primary/20 bg-black/70 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/treatment-ops' && pathname.startsWith(href));
            return (
              <Link key={href} href={href} className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold transition ${active ? 'bg-primary/15 text-primary' : 'text-white/55'}`}>
                <Icon className="size-5" />{label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
