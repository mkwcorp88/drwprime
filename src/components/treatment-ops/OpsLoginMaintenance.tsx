import { Lock } from 'lucide-react';
import Link from 'next/link';

export default function OpsLoginMaintenance() {
  return (
    <div className="fo-glass-page fixed inset-0 z-50 grid min-h-screen place-items-center overflow-y-auto p-4 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(212,175,55,0.18),transparent_36%),radial-gradient(circle_at_85%_80%,rgba(212,175,55,0.06),transparent_35%)]" />
      <div className="fo-glass-modal relative w-full max-w-md rounded-[2rem] p-7 text-center sm:p-9">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary shadow-[0_0_24px_rgba(212,175,55,0.25)]">
          <Lock className="size-7" />
        </span>
        <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.24em] text-primary/70">DRW Prime internal</p>
        <h1 className="mt-2 text-3xl font-bold">Login Ditutup Sementara</h1>
        <p className="mt-3 text-sm leading-7 text-white/50">
          Sistem login Treatment Operations sedang dinonaktifkan untuk pemeliharaan.
          Silakan hubungi Super Admin untuk informasi lebih lanjut.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 text-sm font-semibold text-white/70 transition hover:border-primary/50 hover:text-primary"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
