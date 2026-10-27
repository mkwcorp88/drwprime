'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useStaffAuth } from '@/components/staff-auth/StaffAuthProvider';

export default function AdminNavbar() {
  const { staff, isLoaded, signOut } = useStaffAuth();
  return (
    <nav className="fixed top-0 w-full bg-black/95 backdrop-blur-md z-50 border-b border-primary/20">
      <div className="max-w-7xl mx-auto px-5 flex justify-between items-center py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/drwprime-logo.png" alt="DRW Prime Logo" width={150} height={40} className="h-10 w-auto" />
          <span className="text-primary text-sm font-semibold">Admin</span>
        </Link>
        {isLoaded && (staff ? (
          <div className="flex items-center gap-4">
            <Link href="/" className="text-white hover:text-primary transition-colors text-sm font-medium">Kembali ke website</Link>
            <button type="button" onClick={() => void signOut()} className="rounded-lg border border-primary/40 px-4 py-2 text-sm text-primary hover:bg-primary/10" title={staff.name}>Keluar</button>
          </div>
        ) : (
          <Link href="/staff/sign-in?redirect_url=/admin" className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-dark">Masuk staf</Link>
        ))}
      </div>
    </nav>
  );
}
