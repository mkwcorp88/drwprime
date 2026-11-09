import type { Metadata } from 'next';
import Image from 'next/image';
import { ArrowDown, ArrowRight, CalendarDays, Check, Clock3, Sparkles } from 'lucide-react';
import Navbar from '@/components/Navbar';
import MobileLayout from '@/components/MobileLayout';
import RegistrationForm from '@/components/primeniversary/RegistrationForm';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = buildMetadata({
  title: 'Primeniversary 11.11 Celebrate — IPL Sepuasnya',
  description: 'Rayakan Primeniversary DRW Prime dengan IPL Sepuasnya selama 1 tahun seharga Rp1.111.000. Daftar khusus 11 November 2026.',
  path: '/primeniversary',
});

const treatments = [
  { number: '01', name: 'IPL Acne', detail: 'Untuk perawatan kulit berjerawat.' },
  { number: '02', name: 'IPL Glow', detail: 'Untuk perawatan kulit tampak lebih cerah.' },
  { number: '03', name: 'IPL Vascular', detail: 'Untuk perawatan kemerahan pada kulit.' },
  { number: '04', name: 'IPL Hair Removal', detail: 'Untuk perawatan pengurangan rambut.' },
];

export default function PrimeniversaryPage() {
  return (
    <MobileLayout>
      <main className="overflow-hidden bg-[#090807] text-white">
        <Navbar />
        <section className="relative isolate min-h-[640px] overflow-hidden lg:min-h-[760px] lg:pt-24">
          <div className="absolute inset-0 -z-20"><Image src="/drwprime-laser-room.webp" alt="" fill priority sizes="100vw" className="object-cover opacity-30" /></div>
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#090807_4%,rgba(9,8,7,0.92)_43%,rgba(9,8,7,0.48)_100%),linear-gradient(0deg,#090807,transparent_38%)]" />
          <div className="pointer-events-none absolute right-[-5%] top-[15%] select-none font-playfair text-[180px] leading-none text-[#d9ba6f]/[0.07] sm:text-[280px] lg:top-[18%] lg:text-[390px]" aria-hidden="true">11.11</div>
          <div className="relative mx-auto flex min-h-[640px] max-w-6xl items-center px-5 py-16 sm:py-24 lg:min-h-[650px]">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-[#d9ba6f]/35 bg-[#d9ba6f]/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#e9d19a]"><Sparkles size={14} /> Primeniversary 11.11 Celebrate</p>
              <p className="mt-8 text-xs font-semibold uppercase tracking-[0.28em] text-[#d9ba6f]">A celebration for you</p>
              <h1 className="mt-3 font-playfair text-[3.65rem] leading-[1.03] tracking-tight text-white sm:text-7xl lg:text-8xl">IPL <span className="italic text-[#e8ca80]">Sepuasnya</span></h1>
              <p className="mt-5 text-lg text-white/80 sm:text-xl">Satu tahun merawat diri, satu hadiah istimewa.</p>
              <div className="mt-8 flex flex-wrap items-end gap-x-5 gap-y-2"><div><span className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-[#d9ba6f]">Harga spesial</span><span className="mt-1 block font-playfair text-4xl text-[#f3d895] sm:text-5xl">Rp1.111.000</span></div><span className="mb-1 border-l border-[#d9ba6f]/35 pl-5 text-sm text-white/65">untuk<br /><strong className="text-white">1 tahun</strong></span></div>
              <a href="#daftar" className="mt-9 inline-flex items-center justify-center gap-3 rounded-full bg-[#e5c780] px-7 py-4 text-sm font-bold text-[#18130a] transition hover:bg-[#f7dfa3]">IPL Sepuasnya <ArrowRight size={17} /></a>
              <p className="mt-4 flex items-center gap-2 text-xs text-white/55"><CalendarDays size={14} className="text-[#d9ba6f]" /> Pendaftaran hanya 11 November 2026 · WIB</p>
            </div>
          </div>
          <a href="#pilihan-ipl" className="absolute bottom-7 right-6 hidden items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/45 sm:flex">Discover more <ArrowDown size={14} /></a>
        </section>

        <section className="border-y border-[#d9ba6f]/15 bg-[#12100c] px-5 py-6"><div className="mx-auto grid max-w-6xl gap-4 text-sm text-white/70 sm:grid-cols-3 sm:gap-6"><p className="flex items-center gap-3"><Sparkles size={18} className="shrink-0 text-[#d9ba6f]" /> Empat pilihan treatment IPL</p><p className="flex items-center gap-3"><Clock3 size={18} className="shrink-0 text-[#d9ba6f]" /> Masa aktif 1 tahun setelah pembayaran</p><p className="flex items-center gap-3"><Check size={18} className="shrink-0 text-[#d9ba6f]" /> Sesuai rekomendasi dokter</p></div></section>

        <section id="pilihan-ipl" className="scroll-mt-32 px-5 py-20 sm:py-28"><div className="mx-auto max-w-6xl"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.28em] text-[#d9ba6f]">The IPL collection</p><h2 className="mt-4 font-playfair text-4xl sm:text-5xl">Empat pilihan,<br /><span className="italic text-[#e5c983]">satu paket istimewa.</span></h2></div><p className="max-w-xs text-sm leading-6 text-white/55">Perawatan dipilih sesuai kebutuhan kulit dan rekomendasi dokter DRW Prime.</p></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{treatments.map((t) => <article key={t.name} className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-[#d9ba6f]/40"><div className="flex items-center justify-between"><span className="text-xs tracking-[0.2em] text-[#d9ba6f]/65">{t.number}</span><Sparkles size={17} className="text-[#d9ba6f]/60" /></div><h3 className="mt-10 font-playfair text-2xl text-white">{t.name}</h3><p className="mt-3 text-sm leading-6 text-white/55">{t.detail}</p></article>)}</div><p className="mt-5 text-xs leading-5 text-white/45">Area IPL Hair Removal dan kesesuaian treatment dikonfirmasi bersama tim klinik.</p></div></section>

        <section className="border-y border-[#d9ba6f]/15 bg-[#12100c] px-5 py-20"><div className="mx-auto max-w-6xl"><p className="text-xs font-bold uppercase tracking-[0.28em] text-[#d9ba6f]">How it works</p><h2 className="mt-4 font-playfair text-4xl sm:text-5xl">Langkah kecil untuk <span className="italic text-[#e5c983]">self-care.</span></h2><div className="mt-10 grid gap-8 md:grid-cols-3">{[{n:'01',t:'Daftar pada 11.11',d:'Isi formulir dengan nama dan nomor WhatsApp yang aktif.'},{n:'02',t:'Konfirmasi pembayaran',d:'Tim kami menghubungi Anda untuk informasi pembayaran. Paket aktif setelah pembayaran dikonfirmasi.'},{n:'03',t:'Nikmati treatment IPL',d:'Reservasi jadwal dan jalani treatment sesuai rekomendasi dokter selama masa aktif satu tahun.'}].map((step) => <div key={step.n}><p className="font-playfair text-4xl text-[#d9ba6f]/60">{step.n}</p><h3 className="mt-4 text-lg font-semibold">{step.t}</h3><p className="mt-2 text-sm leading-7 text-white/55">{step.d}</p></div>)}</div></div></section>

        <RegistrationForm serverTime={Date.now()} />
        <section className="border-t border-white/10 px-5 py-16"><div className="mx-auto max-w-4xl"><p className="text-xs font-bold uppercase tracking-[0.28em] text-[#d9ba6f]">Good to know</p><h2 className="mt-4 font-playfair text-3xl sm:text-4xl">Ketentuan paket</h2><ul className="mt-6 space-y-4 text-sm leading-7 text-white/65"><li>• Pendaftaran paket tersedia pada 11 November 2026 pukul 00.00–23.59 WIB.</li><li>• Harga paket IPL Sepuasnya adalah Rp1.111.000. Paket aktif setelah pembayaran dikonfirmasi oleh tim DRW Prime dan berlaku selama satu tahun sejak konfirmasi tersebut.</li><li>• IPL Acne, IPL Glow, IPL Vascular, dan IPL Hair Removal dilakukan sesuai hasil konsultasi dan rekomendasi dokter, dengan reservasi jadwal terlebih dahulu.</li><li>• Detail area IPL Hair Removal dan informasi pembayaran dikonfirmasi oleh tim klinik.</li></ul></div></section>
        <footer className="border-t border-white/10 px-5 py-7 text-center text-xs text-white/40">DRW Prime · Primeniversary 11.11 Celebrate</footer>
      </main>
    </MobileLayout>
  );
}
