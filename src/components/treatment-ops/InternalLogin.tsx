'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, LockKeyhole, Mail } from 'lucide-react';

export default function InternalLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    const response = await fetch('/api/treatment-ops/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) { setError(data.error || 'Tidak dapat masuk'); return; }
    router.replace(data.passwordChangeRequired ? '/treatment-ops/settings' : '/treatment-ops');
    router.refresh();
  };
  return (
    <div className="fo-glass-page fixed inset-0 z-50 grid min-h-screen place-items-center overflow-y-auto p-4 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(212,175,55,0.22),transparent_36%),radial-gradient(circle_at_85%_80%,rgba(212,175,55,0.1),transparent_35%)]" />
      <form onSubmit={submit} className="fo-glass-modal relative w-full max-w-md rounded-[2rem] p-7 sm:p-9">
        <span className="flex size-12 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary shadow-[0_0_24px_rgba(212,175,55,0.3)]">
          <KeyRound className="size-6" />
        </span>
        <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.24em] text-primary/70">DRW Prime internal</p>
        <h1 className="mt-2 text-3xl font-bold">Masuk operasional</h1>
        <p className="mt-2 text-sm leading-6 text-white/50">Gunakan email dan password pribadi yang diterbitkan Super Admin.</p>
        <label className="mt-7 block text-xs font-bold text-white/60">Email
          <div className="mt-2 flex h-12 items-center gap-3 rounded-xl bg-black/30 px-4 ring-1 ring-white/20 focus-within:ring-primary/60"><Mail className="size-4 text-white/35" /><input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="nama@drwprime.com" /></div>
        </label>
        <label className="mt-4 block text-xs font-bold text-white/60">Password
          <div className="mt-2 flex h-12 items-center gap-3 rounded-xl bg-black/30 px-4 ring-1 ring-white/20 focus-within:ring-primary/60"><LockKeyhole className="size-4 text-white/35" /><input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" /></div>
        </label>
        {error && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-xs text-red-300 ring-1 ring-red-400/20">{error}</p>}
        <button disabled={busy} className="mt-6 h-12 w-full rounded-full bg-primary text-sm font-bold text-black transition hover:bg-primary-light disabled:opacity-50">{busy ? 'Memeriksa akun...' : 'Masuk ke Sistem'}</button>
        <p className="mt-5 text-center text-[10px] text-white/30">Password awal wajib diganti saat login pertama.</p>
      </form>
    </div>
  );
}
