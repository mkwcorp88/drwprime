'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, KeyRound, MessageCircle, Phone, RefreshCw, ShieldCheck } from 'lucide-react';

type RequestResponse = {
  challengeId?: string;
  expiresInSeconds?: number;
  resendAfterSeconds?: number;
  message?: string;
  error?: string;
};

async function postJson(url: string, body: Record<string, string>): Promise<{ ok: boolean; data: RequestResponse }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({})) as RequestResponse;
  return { ok: response.ok, data };
}

export default function WhatsAppOtpLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<'request' | 'verify' | 'resend' | null>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const requestCode = async (kind: 'request' | 'resend') => {
    setBusy(kind);
    setError('');
    setNotice('');
    try {
      const { ok, data } = await postJson('/api/treatment-ops/auth/otp/request', { phone });
      if (!ok || !data.challengeId) {
        setError(data.error || 'Kode OTP tidak dapat dikirim. Coba lagi.');
        return;
      }
      setChallengeId(data.challengeId);
      setCode('');
      setResendIn(data.resendAfterSeconds || 60);
      setNotice(data.message || 'Kode OTP telah dikirim melalui WhatsApp.');
    } catch {
      setError('Tidak dapat terhubung ke server. Coba lagi.');
    } finally {
      setBusy(null);
    }
  };

  const submitPhone = async (event: React.FormEvent) => {
    event.preventDefault();
    await requestCode('request');
  };

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy('verify');
    setError('');
    try {
      const { ok, data } = await postJson('/api/treatment-ops/auth/otp/verify', { challengeId, code });
      if (!ok) {
        setError(data.error || 'Kode OTP tidak valid atau sudah kedaluwarsa.');
        return;
      }
      router.replace('/treatment-ops');
      router.refresh();
    } catch {
      setError('Tidak dapat terhubung ke server. Coba lagi.');
    } finally {
      setBusy(null);
    }
  };

  const changePhone = () => {
    setChallengeId('');
    setCode('');
    setResendIn(0);
    setError('');
    setNotice('');
  };

  return (
    <div className="fo-glass-page fixed inset-0 z-50 grid min-h-screen place-items-center overflow-y-auto p-4 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(212,175,55,0.22),transparent_36%),radial-gradient(circle_at_85%_80%,rgba(37,211,102,0.1),transparent_35%)]" />
      <div className="fo-glass-modal relative w-full max-w-md rounded-[2rem] p-7 sm:p-9">
        <span className="flex size-12 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary shadow-[0_0_24px_rgba(212,175,55,0.3)]">
          {challengeId ? <ShieldCheck className="size-6" /> : <KeyRound className="size-6" />}
        </span>
        <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.24em] text-primary/70">DRW Prime internal</p>
        <h1 className="mt-2 text-3xl font-bold">{challengeId ? 'Masukkan kode OTP' : 'Masuk operasional'}</h1>
        <p className="mt-2 text-sm leading-6 text-white/50">
          {challengeId
            ? `Masukkan enam digit kode yang dikirim ke WhatsApp ${phone}.`
            : 'Gunakan nomor WhatsApp yang terdaftar pada data staf DRW Prime.'}
        </p>

        {!challengeId ? (
          <form onSubmit={submitPhone} className="mt-7">
            <label className="block text-xs font-bold text-white/60">
              Nomor WhatsApp
              <div className="mt-2 flex h-12 items-center gap-3 rounded-xl bg-black/30 px-4 ring-1 ring-white/20 focus-within:ring-primary/60">
                <Phone className="size-4 text-white/35" />
                <input
                  required
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
                  placeholder="0812xxxxxxx"
                />
              </div>
            </label>
            {error && <p aria-live="polite" className="mt-4 rounded-xl bg-red-500/10 p-3 text-xs text-red-300 ring-1 ring-red-400/20">{error}</p>}
            <button disabled={busy !== null} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-black transition hover:bg-primary-light disabled:opacity-50">
              <MessageCircle className="size-4" /> {busy === 'request' ? 'Mengirim kode...' : 'Kirim Kode WhatsApp'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="mt-7">
            <label className="block text-xs font-bold text-white/60">
              Kode OTP
              <input
                required
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                className="mt-2 h-14 w-full rounded-xl bg-black/30 px-4 text-center text-2xl font-bold tracking-[0.45em] outline-none ring-1 ring-white/20 focus:ring-primary/60"
                placeholder="000000"
              />
            </label>
            {notice && <p aria-live="polite" className="mt-4 rounded-xl bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-200 ring-1 ring-emerald-400/20">{notice}</p>}
            {error && <p aria-live="polite" className="mt-4 rounded-xl bg-red-500/10 p-3 text-xs text-red-300 ring-1 ring-red-400/20">{error}</p>}
            <button disabled={busy !== null || code.length !== 6} className="mt-6 h-12 w-full rounded-full bg-primary text-sm font-bold text-black transition hover:bg-primary-light disabled:opacity-50">
              {busy === 'verify' ? 'Memverifikasi...' : 'Verifikasi dan Masuk'}
            </button>
            <div className="mt-4 flex items-center justify-between gap-3 text-xs">
              <button type="button" onClick={changePhone} disabled={busy !== null} className="flex items-center gap-1.5 text-white/50 transition hover:text-white disabled:opacity-50">
                <ArrowLeft className="size-3.5" /> Ganti nomor
              </button>
              <button
                type="button"
                onClick={() => void requestCode('resend')}
                disabled={busy !== null || resendIn > 0}
                className="flex items-center gap-1.5 font-semibold text-primary transition hover:text-primary-light disabled:text-white/30"
              >
                <RefreshCw className={`size-3.5 ${busy === 'resend' ? 'animate-spin' : ''}`} />
                {resendIn > 0 ? `Kirim ulang ${resendIn} dtk` : 'Kirim ulang kode'}
              </button>
            </div>
          </form>
        )}

        <p className="mt-6 text-center text-[10px] leading-4 text-white/30">Nama dan hak akses ditentukan otomatis dari data staf terdaftar.</p>
      </div>
    </div>
  );
}
