'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useStaffAuth } from './StaffAuthProvider';

export default function StaffProfilePhoneForm() {
  const { staff, isLoaded, refresh } = useStaffAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const retrySeconds = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const expirySeconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));

  async function post(path: string, body: Record<string, unknown>) {
    const response = await fetch(`/api/staff/phone/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      if (data.retryAfterSeconds) setRetryAt(Date.now() + Number(data.retryAfterSeconds) * 1000);
      throw new Error(data.error || 'Permintaan belum berhasil.');
    }
    return data;
  }

  async function requestCode() {
    setBusy(true); setError('');
    try {
      const data = await post('request', { phone });
      setChallengeId(data.challengeId);
      setCode('');
      setRetryAt(Date.now() + data.resendAfterSeconds * 1000);
      setExpiresAt(Date.now() + data.expiresInSeconds * 1000);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Gagal mengirim kode.'); }
    finally { setBusy(false); }
  }

  async function verifyCode() {
    setBusy(true); setError('');
    try {
      await post('verify', { challengeId, code });
      await refresh();
      window.location.assign('/front-office');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Verifikasi belum berhasil.'); }
    finally { setBusy(false); }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#090b0c] px-4 py-8 text-white">
      <section className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#111418] p-6 shadow-2xl sm:p-9">
        <Link href="/" className="mb-8 inline-block"><Image src="/drwprime-logo.png" alt="DRW Prime" width={170} height={52} className="h-auto w-40" /></Link>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">Staff access</p>
        <h1 className="text-2xl font-semibold">Verifikasi WhatsApp staf</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/55">Tambahkan nomor terverifikasi agar berikutnya Anda bisa masuk lewat WhatsApp maupun Google.</p>
        {!isLoaded ? <p role="status" className="mt-6 text-sm text-white/60">Menyiapkan profil…</p> : staff?.phone ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-xl border border-primary/25 bg-primary/10 p-4 text-sm text-primary">Nomor +{staff.phone} sudah terverifikasi.</p>
            <Link href="/front-office" className="block rounded-full bg-primary px-5 py-3 text-center text-sm font-semibold text-black">Buka Front Office</Link>
          </div>
        ) : <div className="mt-6 space-y-4">
          <label htmlFor="staff-profile-phone" className="block text-sm text-white/80">Nomor WhatsApp staf</label>
          <input id="staff-profile-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} readOnly={Boolean(challengeId)} placeholder="0812 3456 7890" className="min-h-12 w-full rounded-xl border border-white/15 bg-white/[0.055] px-4 py-3 text-sm text-white outline-none focus:border-primary/70" />
          {challengeId && <>
            <label htmlFor="staff-profile-code" className="block text-sm text-white/80">Kode OTP 6 digit</label>
            <input id="staff-profile-code" type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} className="min-h-12 w-full rounded-xl border border-white/15 bg-white/[0.055] px-4 py-3 text-center text-xl tracking-[0.3em] text-white outline-none focus:border-primary/70" />
            <p className="text-xs text-white/50">{expirySeconds ? `Berlaku ${Math.floor(expirySeconds / 60)}:${String(expirySeconds % 60).padStart(2, '0')} lagi.` : 'Kode kedaluwarsa. Kirim ulang.'}</p>
          </>}
          {error && <p role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
          <button type="button" disabled={busy || (!challengeId && (!phone || retrySeconds > 0)) || (Boolean(challengeId) && (!expirySeconds || code.length !== 6))} onClick={challengeId ? verifyCode : requestCode} className="min-h-12 w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-black disabled:opacity-50">
            {busy ? 'Memproses…' : challengeId ? 'Verifikasi nomor' : retrySeconds ? `Tunggu ${retrySeconds} detik` : 'Kirim kode ke WhatsApp'}
          </button>
          {challengeId && <div className="flex justify-between text-xs text-primary">
            <button type="button" disabled={busy || retrySeconds > 0} onClick={requestCode} className="disabled:text-white/40">{retrySeconds ? `Kirim ulang dalam ${retrySeconds} detik` : 'Kirim ulang'}</button>
            <button type="button" disabled={busy} onClick={() => { setChallengeId(''); setCode(''); setRetryAt(0); }} className="text-white/60">Ganti nomor</button>
          </div>}
          <Link href="/front-office" className="block pt-2 text-center text-xs text-white/50 hover:text-primary">Lewati untuk sekarang</Link>
        </div>}
      </section>
    </main>
  );
}
