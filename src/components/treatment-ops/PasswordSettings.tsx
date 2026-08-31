'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, ShieldCheck } from 'lucide-react';
import PasswordInput from '@/components/treatment-ops/PasswordInput';

export default function PasswordSettings({
  staffName,
  email,
  forced,
}: {
  staffName: string;
  email: string | null;
  forced: boolean;
}) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmation) {
      setError('Konfirmasi password baru tidak sama.');
      return;
    }

    setBusy(true);
    const response = await fetch('/api/treatment-ops/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      if (response.status === 401) router.replace('/treatment-ops/login');
      setError(data.error || 'Password tidak dapat diubah.');
      return;
    }
    router.replace('/treatment-ops');
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-2xl">
      <section className="mobile-surface rounded-[28px] p-5 sm:p-9">
        <span className="flex size-12 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
          {forced ? <ShieldCheck className="size-6" /> : <KeyRound className="size-6" />}
        </span>
        <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Keamanan akun</p>
        <h1 className="font-playfair mt-2 text-3xl font-bold">{forced ? 'Buat password pribadi' : 'Ganti password'}</h1>
        <p className="mt-2 text-sm leading-6 text-white/50">
          {forced
            ? 'Password awal bersifat sementara. Ganti password sebelum menggunakan dashboard.'
            : 'Gunakan password unik yang tidak dipakai pada akun lain.'}
        </p>
        <div className="mt-5 rounded-2xl bg-white/[0.04] p-4 text-xs text-white/55 ring-1 ring-white/10">
          <strong className="block text-white">{staffName}</strong>
          <span>{email || 'Email belum tercatat'}</span>
        </div>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <PasswordField label="Password saat ini" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
          <PasswordField label="Password baru" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
          <PasswordField label="Konfirmasi password baru" value={confirmation} onChange={setConfirmation} autoComplete="new-password" />
          <p className="text-[11px] leading-5 text-white/40">Minimal 10 karakter dengan huruf besar, huruf kecil, angka, dan simbol.</p>
          {error && <p className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-200">{error}</p>}
          <button disabled={busy} className="h-12 w-full rounded-full bg-primary text-sm font-bold text-black transition hover:bg-primary-light disabled:opacity-50">
            {busy ? 'Menyimpan...' : 'Simpan Password Baru'}
          </button>
        </form>
      </section>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  return (
    <label className="block text-xs font-bold text-white/60">
      {label}
      <PasswordInput
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        className="mt-2"
        inputClassName="min-h-[52px] w-full rounded-[16px] border border-white/15 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-primary/60"
      />
    </label>
  );
}
