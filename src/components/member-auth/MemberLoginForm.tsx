'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { memberRedirect } from '@/lib/member-auth/policy';
import { useMemberAuth } from './MemberAuthProvider';

type Stage = 'phone' | 'code' | 'register' | 'activate' | 'support';
const inputClass = 'min-h-12 w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30';

export default function MemberLoginForm() {
  const params = useSearchParams();
  const { user, enrollment, isLoaded, otpAvailable } = useMemberAuth();
  const [stage, setStage] = useState<Stage>('phone');
  const [phone, setPhone] = useState(params.get('phone') || '');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setBirthDate] = useState('');
  const [referralCode, setReferralCode] = useState(params.get('ref') || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const destination = memberRedirect(params.get('redirect_url') || params.get('redirect'));

  useEffect(() => {
    if (!isLoaded) return;
    if (user) { window.location.replace(destination); return; }
    if (enrollment) {
      setStage(enrollment.stage);
      setPhone(enrollment.phone);
    }
  }, [user, enrollment, isLoaded, destination]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const retrySeconds = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const expirySeconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));

  async function post(path: string, body: Record<string, unknown>) {
    const response = await fetch(`/api/member-auth/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      if (data.retryAfterSeconds) setRetryAt(Date.now() + Number(data.retryAfterSeconds) * 1000);
      throw new Error(data.error || 'Permintaan belum berhasil. Silakan coba lagi.');
    }
    return data;
  }

  async function requestCode() {
    setBusy(true); setError('');
    try {
      const data = await post('request', { phone });
      setChallengeId(data.challengeId);
      setPhone(data.phone);
      setCode('');
      setRetryAt(Date.now() + data.resendAfterSeconds * 1000);
      setExpiresAt(Date.now() + data.expiresInSeconds * 1000);
      setNow(Date.now());
      setStage('code');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Koneksi bermasalah. Coba lagi.'); }
    finally { setBusy(false); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (stage === 'phone') { await requestCode(); return; }
    setBusy(true); setError('');
    try {
      if (stage === 'code') {
        const data = await post('verify', { challengeId, code });
        if (data.stage === 'done') { window.location.assign(destination); return; }
        setStage(data.stage);
      } else {
        await post('enroll', { firstName, lastName, email, referralCode, dateOfBirth });
        window.location.assign(destination);
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Koneksi bermasalah. Coba lagi.'); }
    finally { setBusy(false); }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-black px-5 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.13),transparent_65%)]" />
      <div className="relative w-full max-w-md">
        <Link href="/" className="mb-8 flex justify-center"><Image src="/drwprime-logo.png" alt="DRW Prime" width={200} height={60} priority className="h-auto w-48" /></Link>
        <section className="rounded-3xl border border-primary/25 bg-gradient-to-br from-gray-900 to-black p-6 shadow-2xl sm:p-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">My Prime</p>
          <h1 className="mb-2 font-playfair text-2xl font-bold">
            {stage === 'phone' ? 'Masuk dengan WhatsApp' : stage === 'code' ? 'Masukkan kode verifikasi' : stage === 'register' ? 'Selamat datang di DRW Prime' : stage === 'activate' ? 'Aktifkan akun lama Anda' : 'Bantuan aktivasi akun'}
          </h1>
          <p className="mb-6 text-sm leading-relaxed text-white/65">
            {stage === 'phone' && 'Akses poin, riwayat treatment, dan benefit member dengan nomor WhatsApp Anda.'}
            {stage === 'code' && `Kode dikirim ke +${phone} melalui WhatsApp dari DRW Primé Notif (+62 815-4288-8666).`}
            {stage === 'register' && 'Nomor WhatsApp berhasil diverifikasi. Lengkapi informasi berikut untuk membuat akun.'}
            {stage === 'activate' && 'Cocokkan identitas dengan data yang sudah tercatat di klinik agar akun dan riwayat Anda dapat diaktifkan.'}
            {stage === 'support' && 'Nomor Anda berhasil diverifikasi. Hubungi Front Office untuk mencocokkan data atau memulihkan nomor login akun lama.'}
          </p>
          {!isLoaded ? <p role="status" className="text-sm text-white/60">Menyiapkan login…</p> : stage === 'support' ? (
            <a href="https://wa.me/6281138800071" className="block rounded-xl bg-primary px-4 py-3 text-center font-semibold text-black">Hubungi Front Office</a>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {stage === 'phone' && <div>
                <label htmlFor="login-phone" className="mb-2 block text-sm">Nomor WhatsApp</label>
                <input id="login-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0812 3456 7890" maxLength={40} required autoFocus className={inputClass} />
                <p className="mt-2 text-xs text-white/50">Nomor baru dapat lanjut mendaftar setelah verifikasi OTP.</p>
              </div>}
              {stage === 'code' && <div>
                <label htmlFor="login-code" className="mb-2 block text-sm">Kode OTP 6 digit</label>
                <input id="login-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} minLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required autoFocus className={`${inputClass} text-center text-2xl tracking-[0.35em]`} aria-describedby="otp-expiry" />
                <p id="otp-expiry" className="mt-2 text-xs text-white/50">{expirySeconds ? `Berlaku ${Math.floor(expirySeconds / 60)}:${String(expirySeconds % 60).padStart(2, '0')} lagi.` : 'Kode kedaluwarsa. Silakan kirim ulang.'}</p>
              </div>}
              {stage === 'register' && <>
                <label className="block text-sm">Nama depan<input value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" required minLength={2} maxLength={100} className={`${inputClass} mt-2`} /></label>
                <label className="block text-sm">Nama belakang <span className="text-white/40">(opsional)</span><input value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" maxLength={100} className={`${inputClass} mt-2`} /></label>
                <label className="block text-sm">Email <span className="text-white/40">(opsional)</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={254} className={`${inputClass} mt-2`} /></label>
                <label className="block text-sm">Kode afiliasi <span className="text-white/40">(opsional)</span><input value={referralCode} onChange={(event) => setReferralCode(event.target.value.toUpperCase())} maxLength={10} className={`${inputClass} mt-2`} /></label>
              </>}
              {stage === 'activate' && <>
                <label className="block text-sm">Tanggal lahir sesuai data klinik<input type="date" value={dateOfBirth} onChange={(event) => setBirthDate(event.target.value)} required className={`${inputClass} mt-2 [color-scheme:dark]`} /></label>
              </>}
              {error && <p role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
              {!otpAvailable && stage === 'phone' && <p role="status" className="rounded-xl bg-white/5 p-3 text-sm text-white/70">Layanan login WhatsApp sedang disiapkan. Silakan coba lagi nanti.</p>}
              <button disabled={busy || (stage === 'phone' && (!otpAvailable || retrySeconds > 0)) || (stage === 'code' && (!expirySeconds || code.length !== 6))} className="min-h-12 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-black transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? 'Memproses…' : stage === 'phone' ? (retrySeconds ? `Tunggu ${retrySeconds} detik` : 'Kirim kode ke WhatsApp') : stage === 'code' ? 'Verifikasi & lanjutkan' : stage === 'register' ? 'Buat akun member' : 'Aktifkan akun saya'}
              </button>
              {stage === 'code' && <button type="button" disabled={busy || retrySeconds > 0} onClick={requestCode} className="min-h-11 w-full py-2 text-sm text-primary disabled:text-white/40">{retrySeconds ? `Kirim ulang dalam ${retrySeconds} detik` : 'Kirim ulang kode'}</button>}
            </form>
          )}
          {stage !== 'phone' && <button type="button" disabled={busy} onClick={() => { setStage('phone'); setCode(''); setError(''); }} className="mt-4 min-h-11 w-full py-2 text-sm text-white/60 hover:text-primary">Gunakan nomor lain / mulai ulang</button>}
          {(stage === 'phone' || stage === 'activate') && <a href="https://wa.me/6281138800071" className="mt-4 block text-center text-xs text-white/50 hover:text-primary">Sudah punya akun, tetapi nomor berubah? Hubungi Front Office.</a>}
        </section>
        <div className="mt-6 flex items-center justify-between text-xs text-white/50"><Link href="/" className="py-2 hover:text-primary">Kembali ke website</Link><Link href="/staff/sign-in" className="py-2 hover:text-primary">Login staf</Link></div>
      </div>
    </main>
  );
}
