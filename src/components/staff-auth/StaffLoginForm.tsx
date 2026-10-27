'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, ShieldCheck } from 'lucide-react';
import GoogleLoginButton from '@/components/member-auth/GoogleLoginButton';
import { useStaffAuth } from './StaffAuthProvider';

const inputClass = 'min-h-12 w-full rounded-xl border border-white/15 bg-white/[0.055] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-primary/15';

function staffRedirect(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return '/front-office';
  try {
    const url = new URL(value, 'https://staff.invalid');
    const allowed = ['/front-office', '/marketing', '/admin', '/cms', '/staff/profile'];
    if (url.origin !== 'https://staff.invalid' || !allowed.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`))) return '/front-office';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return '/front-office'; }
}

export default function StaffLoginForm() {
  const params = useSearchParams();
  const { isLoaded, isSignedIn } = useStaffAuth();
  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const destination = staffRedirect(params.get('redirect_url') || params.get('redirect'));

  useEffect(() => {
    if (isLoaded && isSignedIn) window.location.replace(destination);
  }, [isLoaded, isSignedIn, destination]);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const retrySeconds = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const expirySeconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));

  async function post(path: string, body: Record<string, unknown>) {
    const response = await fetch(`/api/staff/auth/otp/${path}`, {
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
      await post('verify', { challengeId, code });
      window.location.assign(destination);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Koneksi bermasalah. Coba lagi.'); }
    finally { setBusy(false); }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#090b0c] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(212,175,55,0.1),transparent_36%),radial-gradient(circle_at_90%_85%,rgba(212,175,55,0.05),transparent_30%)]" />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[1160px] items-center px-4 py-4 sm:px-7 lg:py-7">
        <div className="grid w-full overflow-hidden rounded-[28px] border border-white/10 bg-[#111418] shadow-[0_32px_100px_rgba(0,0,0,0.45)] lg:min-h-[610px] lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-10">
            <Image src="/drwprime-resepsionis.webp" alt="Interior resepsionis DRW Prime" fill priority sizes="(min-width: 1024px) 45vw, 0px" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/15 to-black/85" />
            <Link href="/" className="relative z-10 w-fit rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary"><Image src="/drwprime-logo.png" alt="DRW Prime" width={190} height={58} priority className="h-auto w-44" /></Link>
            <div className="relative z-10 max-w-sm">
              <div className="mb-5 h-px w-10 bg-primary" />
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">Staff workspace</p>
              <h2 className="text-4xl font-semibold leading-[1.12] tracking-tight">Bekerja lebih dekat, melayani lebih baik.</h2>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/75">Akses aman untuk tim Front Office dan marketing DRW Prime.</p>
              <div className="mt-8 border-t border-white/25 pt-4 text-xs tracking-wide text-white/70">DRW Primé Aesthetic Clinic</div>
            </div>
          </aside>

          <section className="flex min-w-0 flex-col px-6 py-7 sm:px-10 sm:py-9 lg:px-14 lg:py-9">
            <div className="flex items-center justify-between gap-4 lg:hidden">
              <Link href="/" className="w-fit rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary"><Image src="/drwprime-logo.png" alt="DRW Prime" width={170} height={52} priority className="h-auto w-36 sm:w-40" /></Link>
              <span className="hidden rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary min-[375px]:inline-flex">Staff area</span>
            </div>

            <div className="mx-auto flex w-full min-w-0 max-w-[410px] flex-1 flex-col justify-center py-8 lg:py-3">
              <div className="mb-7">
                <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary"><span className="h-px w-6 bg-primary/70" /> Staff access</div>
                <h1 className="text-[1.8rem] font-semibold leading-tight tracking-tight sm:text-[2rem]">{stage === 'phone' ? 'Masuk sebagai staf' : 'Verifikasi WhatsApp'}</h1>
                <p className="mt-3 text-sm leading-relaxed text-white/55">{stage === 'phone' ? 'Gunakan akun Google atau nomor WhatsApp yang terdaftar sebagai staf.' : 'Masukkan kode 6 digit yang dikirim ke nomor WhatsApp staf Anda.'}</p>
              </div>

              {!isLoaded ? <p role="status" className="text-sm text-white/60">Menyiapkan login…</p> : <>
                {stage === 'phone' && <>
                  <GoogleLoginButton mode="staff" destination={destination} />
                  <div className="my-5 flex items-center gap-3 text-[11px] text-white/40"><span className="h-px flex-1 bg-white/10" />atau masuk dengan WhatsApp<span className="h-px flex-1 bg-white/10" /></div>
                </>}
                <form onSubmit={submit} className="space-y-4">
                  {stage === 'phone' ? <div>
                    <label htmlFor="staff-phone" className="mb-2 block text-sm font-medium text-white/80">Nomor WhatsApp staf</label>
                    <input id="staff-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0812 3456 7890" maxLength={40} required className={inputClass} />
                  </div> : <div>
                    <label htmlFor="staff-code" className="mb-2 block text-sm font-medium text-white/80">Kode OTP 6 digit</label>
                    <input id="staff-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} minLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required autoFocus className={`${inputClass} text-center text-2xl tracking-[0.35em]`} aria-describedby="staff-otp-expiry" />
                    <p id="staff-otp-expiry" className="mt-2 text-xs text-white/50">{expirySeconds ? `Berlaku ${Math.floor(expirySeconds / 60)}:${String(expirySeconds % 60).padStart(2, '0')} lagi.` : 'Kode kedaluwarsa. Silakan kirim ulang.'}</p>
                  </div>}
                  {error && <p role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
                  <button disabled={busy || (stage === 'phone' && retrySeconds > 0) || (stage === 'code' && (!expirySeconds || code.length !== 6))} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-[#111418] transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50">
                    {busy ? 'Memproses…' : stage === 'phone' ? (retrySeconds ? `Tunggu ${retrySeconds} detik` : 'Kirim kode ke WhatsApp') : 'Verifikasi & masuk'}
                    {!busy && !retrySeconds && <ArrowRight size={17} aria-hidden="true" />}
                  </button>
                  {stage === 'code' && <button type="button" disabled={busy || retrySeconds > 0} onClick={requestCode} className="min-h-11 w-full py-2 text-sm text-primary disabled:text-white/40">{retrySeconds ? `Kirim ulang dalam ${retrySeconds} detik` : 'Kirim ulang kode'}</button>}
                </form>
                {stage === 'phone' && <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-white/45"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-primary/75" aria-hidden="true" />Belum punya nomor staf? Masuk lewat Google, lalu verifikasi WhatsApp di profil staf.</p>}
              </>}
              {stage === 'code' && <button type="button" disabled={busy} onClick={() => { setStage('phone'); setCode(''); setError(''); }} className="mt-5 w-fit py-2 text-sm text-white/55 transition-colors hover:text-primary">← Gunakan nomor lain</button>}
            </div>

            <div className="mx-auto flex w-full max-w-[410px] items-center justify-between gap-3 border-t border-white/10 pt-5 text-xs text-white/45">
              <Link href="/" className="inline-flex items-center gap-1.5 py-1 transition-colors hover:text-primary">Kembali ke website <ArrowUpRight size={13} aria-hidden="true" /></Link>
              <Link href="/sign-in" className="inline-flex items-center gap-1.5 py-1 transition-colors hover:text-primary">Login member <ArrowUpRight size={13} aria-hidden="true" /></Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
