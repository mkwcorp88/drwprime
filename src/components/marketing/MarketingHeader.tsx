'use client';

import Link from 'next/link';
import { useStaffAuth } from '@/components/staff-auth/StaffAuthProvider';

export default function MarketingHeader() {
  const { staff, isLoaded, signOut } = useStaffAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-primary/20 bg-black/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/marketing" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-dark font-bold">DR</div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-primary">Derma Rich Wellness</p>
            <p className="text-[11px] text-white/60">Digital Marketing Dashboard</p>
          </div>
        </Link>
        {isLoaded && (staff ? (
          <button type="button" onClick={() => void signOut()} className="rounded-lg border border-primary/40 px-4 py-2 text-sm text-primary hover:bg-primary/10" title={staff.name}>Keluar</button>
        ) : (
          <Link href="/staff/sign-in?redirect_url=/marketing" className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-dark">Masuk staf</Link>
        ))}
      </div>
    </header>
  );
}
