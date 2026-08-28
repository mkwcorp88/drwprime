'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Phone } from 'lucide-react';
import type { OpsRole } from '@prisma/client';
import { roleLabels } from '@/lib/treatment-operations/constants';
import { formatPhone } from '@/lib/phone';

export type ProfileStaff = {
  name: string;
  role: OpsRole;
  employeeId: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  branchName: string | null;
};

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export default function ProfileSettings({ staff }: { staff: ProfileStaff }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [phone, setPhone] = useState(staff.phone ?? '');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<'phone' | 'avatar' | null>(null);

  const savePhone = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(''); setNotice('');
    setBusy('phone');
    const response = await fetch('/api/treatment-ops/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const data = await response.json();
    setBusy(null);
    if (!response.ok) {
      if (response.status === 401) router.replace('/treatment-ops/login');
      setError(data.error || 'Nomor WhatsApp tidak dapat disimpan.');
      return;
    }
    setNotice('Nomor WhatsApp tersimpan.');
    router.refresh();
  };

  const uploadAvatar = async (file: File) => {
    setError(''); setNotice('');
    setBusy('avatar');
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('/api/treatment-ops/profile/avatar', { method: 'POST', body: formData });
    const data = await response.json();
    setBusy(null);
    if (!response.ok) {
      if (response.status === 401) router.replace('/treatment-ops/login');
      setError(data.error || 'Foto tidak dapat diunggah.');
      return;
    }
    setNotice('Foto profil tersimpan.');
    router.refresh();
  };

  return (
    <section className="fo-glass-card rounded-[2rem] p-7 sm:p-9">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Profil</p>
      <h1 className="font-playfair mt-2 text-3xl font-bold">Profil pribadi</h1>
      <p className="mt-2 text-sm leading-6 text-white/50">Nama dan role diatur Super Admin. Lengkapi foto dan nomor WhatsApp kamu.</p>

      <div className="mt-7 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <div className="relative">
          {staff.avatarUrl ? (
            <img src={staff.avatarUrl} alt={staff.name} className="size-20 rounded-full object-cover ring-2 ring-primary/40" />
          ) : (
            <span className="flex size-20 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-2xl font-bold text-primary">
              {initials(staff.name)}
            </span>
          )}
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => fileInput.current?.click()}
            className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full bg-primary text-black shadow-lg transition hover:bg-primary-light disabled:opacity-50"
            aria-label="Unggah foto"
          >
            <Camera className="size-4" />
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadAvatar(file);
              event.target.value = '';
            }}
          />
        </div>
        <div className="min-w-0">
          <h2 className="font-playfair text-xl font-bold">{staff.name}</h2>
          <p className="mt-1 text-xs font-bold text-primary">{roleLabels[staff.role]}</p>
          <p className="mt-1 text-xs text-white/45">{staff.employeeId}{staff.branchName ? ` · ${staff.branchName}` : ''}</p>
          <p className="mt-1 text-xs text-white/45">{staff.email || 'Email belum tercatat'}</p>
        </div>
      </div>

      {error && <p className="mt-5 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-200">{error}</p>}
      {notice && <p className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs text-emerald-200">{notice}</p>}

      <form onSubmit={savePhone} className="mt-7">
        <label className="block text-xs font-bold text-white/60">
          Nomor WhatsApp
          <div className="mt-2 flex items-center gap-3 rounded-xl bg-black/30 px-4 ring-1 ring-white/20 focus-within:ring-primary/60">
            <Phone className="size-4 text-white/35" />
            <input
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="0812xxxxxxx"
              className="h-12 min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
            />
          </div>
        </label>
        <p className="mt-2 text-[11px] text-white/40">Contoh: 08123456789. Tersimpan otomatis sebagai {formatPhone(phone || '6281234567890')}.</p>
        <button disabled={busy !== null} className="mt-4 h-12 w-full rounded-full bg-primary text-sm font-bold text-black transition hover:bg-primary-light disabled:opacity-50">
          {busy === 'phone' ? 'Menyimpan...' : 'Simpan Nomor WhatsApp'}
        </button>
      </form>
    </section>
  );
}
