'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, LoaderCircle } from 'lucide-react';
import { campaignPhase } from '@/lib/primeniversary';

const REQUEST_KEY = 'drw-primeniversary-request-id';

export default function RegistrationForm({ serverTime }: { serverTime: number }) {
  const [phase, setPhase] = useState(() => campaignPhase(new Date(serverTime)));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const requestId = useRef('');

  useEffect(() => {
    // Progress from the server clock rather than trusting a visitor's device clock.
    const started = performance.now();
    const refreshPhase = () => setPhase(campaignPhase(new Date(serverTime + performance.now() - started)));
    const timer = window.setInterval(refreshPhase, 30_000);
    return () => window.clearInterval(timer);
  }, [serverTime]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      if (!requestId.current) {
        try {
          requestId.current = sessionStorage.getItem(REQUEST_KEY) || crypto.randomUUID();
          sessionStorage.setItem(REQUEST_KEY, requestId.current);
        } catch {
          requestId.current = crypto.randomUUID();
        }
      }
      const response = await fetch('/api/primeniversary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: requestId.current,
          name: data.get('name'), phone: data.get('phone'), email: data.get('email'),
          consent: data.get('consent') === 'on',
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Pendaftaran belum berhasil. Silakan coba lagi.');
      setCode(result.code);
      try { sessionStorage.removeItem(REQUEST_KEY); } catch { /* Storage is optional. */ }
      requestId.current = '';
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  const field = 'mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3.5 text-base text-white placeholder:text-white/30 outline-none transition focus:border-[#d9ba6f] focus:ring-2 focus:ring-[#d9ba6f]/20';

  return (
    <section id="daftar" className="scroll-mt-32 px-5 py-16 sm:py-24">
      <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#d9ba6f]">Your invitation</p>
          <h2 className="mt-4 font-playfair text-4xl leading-tight text-white sm:text-5xl">Siap rayakan<br /><span className="italic text-[#e5c983]">momenmu?</span></h2>
          <p className="mt-5 max-w-md text-sm leading-7 text-white/65 sm:text-base">Daftarkan dirimu untuk paket IPL Sepuasnya. Tim DRW Prime akan menghubungi melalui WhatsApp untuk konfirmasi dan informasi pembayaran.</p>
          <div className="mt-7 inline-flex items-center gap-3 rounded-full border border-[#d9ba6f]/25 bg-[#d9ba6f]/5 px-4 py-2 text-xs text-[#f0dda9]">
            <span className="h-2 w-2 rounded-full bg-[#d9ba6f]" /> 11 November 2026 · 00.00–23.59 WIB
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-[#d9ba6f]/25 bg-[linear-gradient(145deg,rgba(43,35,22,0.8),rgba(12,11,10,0.98))] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.3)] sm:p-9">
          {code ? (
            <div className="py-5 text-center" role="status">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#d9ba6f]/40 bg-[#d9ba6f]/10 text-[#e8cd88]"><Check size={26} /></div>
              <h3 className="mt-5 font-playfair text-3xl text-white">Pendaftaran diterima</h3>
              <p className="mt-3 text-sm leading-6 text-white/65">Simpan kode pendaftaran ini. Tim kami akan menghubungi Anda melalui WhatsApp untuk konfirmasi dan pembayaran.</p>
              <p className="my-6 rounded-xl border border-[#d9ba6f]/25 bg-black/30 px-4 py-4 font-mono text-lg font-bold tracking-wider text-[#e8cd88]">{code}</p>
              <p className="text-xs leading-5 text-white/50">Paket aktif setelah pembayaran dikonfirmasi; pendaftaran belum merupakan bukti pembayaran.</p>
              <button type="button" onClick={() => setCode('')} className="mt-6 text-sm font-semibold text-[#e8cd88] underline underline-offset-4">Daftarkan pasien lain</button>
            </div>
          ) : (
            <>
              <div className="mb-7 flex items-start justify-between gap-4 border-b border-white/10 pb-5">
                <div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#d9ba6f]">Pendaftaran paket</p><h3 className="mt-2 font-playfair text-2xl text-white">IPL Sepuasnya</h3></div>
                <p className="text-right text-sm font-bold text-[#f3d895]">Rp1.111.000<span className="mt-1 block text-[11px] font-normal text-white/45">1 tahun</span></p>
              </div>
              {phase !== 'open' && <div className="mb-5 rounded-xl border border-[#d9ba6f]/25 bg-[#d9ba6f]/10 px-4 py-3 text-sm leading-6 text-[#f2ddaa]" role="status">
                {phase === 'upcoming' ? 'Pendaftaran dibuka pada 11 November 2026 pukul 00.00 WIB.' : 'Pendaftaran promo 11.11 telah ditutup.'}
              </div>}
              <form onSubmit={submit} className="space-y-5">
                <label className="block text-sm font-medium text-white/85">Nama lengkap pasien<input className={field} name="name" autoComplete="name" minLength={2} maxLength={100} placeholder="Nama sesuai identitas" required disabled={phase !== 'open' || submitting} /></label>
                <label className="block text-sm font-medium text-white/85">Nomor WhatsApp<input className={field} name="phone" type="tel" autoComplete="tel" maxLength={40} placeholder="Contoh: 0812 3456 7890" required disabled={phase !== 'open' || submitting} /></label>
                <label className="block text-sm font-medium text-white/85">Email <span className="font-normal text-white/45">(opsional)</span><input className={field} name="email" type="email" autoComplete="email" maxLength={254} placeholder="nama@email.com" disabled={phase !== 'open' || submitting} /></label>
                <label className="flex items-start gap-3 text-xs leading-5 text-white/65"><input name="consent" type="checkbox" required disabled={phase !== 'open' || submitting} className="mt-1 h-4 w-4 shrink-0 accent-[#d9ba6f]" /><span>Saya memahami masa aktif dan ketentuan paket, serta bersedia dihubungi DRW Prime untuk konfirmasi pendaftaran. Baca <Link href="/privacy-policy" className="text-[#e6c982] underline underline-offset-2" target="_blank">kebijakan privasi</Link>.</span></label>
                {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
                <button type="submit" disabled={phase !== 'open' || submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#e5c780] px-5 py-4 text-sm font-bold text-[#18130a] transition hover:bg-[#f5dea4] disabled:cursor-not-allowed disabled:opacity-40">
                  {submitting ? <><LoaderCircle className="animate-spin" size={17} /> Mengirim...</> : <>Daftar IPL Sepuasnya <ArrowRight size={17} /></>}
                </button>
                <p className="text-center text-[11px] leading-5 text-white/40">Pendaftaran tidak langsung mengaktifkan paket. Pembayaran dikonfirmasi oleh tim DRW Prime.</p>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
