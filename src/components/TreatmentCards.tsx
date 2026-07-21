'use client';

import Link from "next/link";

const skinIssues = [
  { title: "Jerawat", href: "/treatments?category=facial-basic" },
  { title: "Flek Hitam", href: "/treatments?category=facial-basic" },
  { title: "Kulit Kusam", href: "/treatments?category=facial-basic" },
  { title: "Penuaan Dini", href: "/treatments?category=facial-basic" },
];

const services = [
  {
    title: "Treatment Wajah",
    href: "/treatments?category=facial-basic",
  },
  {
    title: "Treatment Tubuh",
    href: "/treatments?category=body-treatment",
  },
  {
    title: "Home Treatment",
    href: "/home-treatment",
  },
];

export default function TreatmentCards() {
  return (
    <div className="lg:hidden bg-dark">
      {/* ───── Hero Consultation Card ───── */}
      <div className="mx-4 mt-4 mb-4 relative overflow-hidden rounded-2xl bg-[#111] border border-primary/25">
        {/* Abstract skin-analysis background */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.07]">
          {/* Hexagonal pattern */}
          <svg className="absolute top-0 right-0 w-64 h-64 text-primary" viewBox="0 0 200 200">
            <defs>
              <pattern id="hex" width="28" height="48" patternUnits="userSpaceOnUse" patternTransform="scale(0.8)">
                <path d="M14 0l14 8v16l-14 8L0 24V8z" fill="none" stroke="currentColor" strokeWidth="0.8"/>
              </pattern>
            </defs>
            <rect width="200" height="200" fill="url(#hex)"/>
          </svg>
          {/* Gold contour lines */}
          <svg className="absolute bottom-0 left-0 w-48 h-48 text-primary" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="55" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.6"/>
            <circle cx="60" cy="60" r="40" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.4"/>
            <circle cx="60" cy="60" r="25" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.5"/>
            <circle cx="60" cy="60" r="8" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.7"/>
            <line x1="60" y1="5" x2="60" y2="115" stroke="currentColor" strokeWidth="0.3" opacity="0.3"/>
            <line x1="5" y1="60" x2="115" y2="60" stroke="currentColor" strokeWidth="0.3" opacity="0.3"/>
          </svg>
          {/* Subtle dot grid */}
          <div className="absolute top-4 left-4 opacity-30">
            {[...Array(5)].map((_, r) => (
              <div key={r} className="flex gap-1.5 mb-1.5">
                {[...Array(8)].map((_, c) => (
                  <div key={c} className="w-0.5 h-0.5 rounded-full bg-primary/60"/>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 px-5 py-7">
          <h2 className="text-lg font-bold text-white leading-tight mb-1">
            Konsultasikan Masalah
          </h2>
          <h2 className="text-lg font-bold text-white leading-tight mb-3">
            Kulitmu
          </h2>
          <p className="text-sm text-white/60 mb-5">
            Gratis bersama DRW Prime
          </p>

          <Link
            href="#contact"
            className="inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-dark transition-colors hover:bg-primary-light active:scale-95"
          >
            Konsultasi Gratis
          </Link>

          <p className="mt-3 text-xs text-white/40">
            Tanpa biaya &bull; Respons cepat
          </p>
        </div>
      </div>

      {/* ───── Skin Issue Cards ───── */}
      <div className="mx-4 mb-5">
        <h3 className="text-sm font-semibold text-white mb-3">
          Apa Keluhan Kulitmu?
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          {skinIssues.map((issue) => (
            <Link
              key={issue.title}
              href={issue.href}
              className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#111] px-3.5 py-3 transition-all hover:border-primary/40 active:scale-[0.98]"
            >
              <span aria-hidden="true" className="h-5 w-px bg-primary/80" />
              <span className="text-xs font-medium tracking-[0.01em] text-white/80">
                {issue.title}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* ───── Layanan Lainnya ───── */}
      <div className="mx-4 pb-6">
        <h3 className="text-sm font-semibold text-white mb-3">
          Layanan Lainnya
        </h3>
        <div className="flex flex-col gap-2">
          {services.map((svc) => (
            <Link
              key={svc.title}
              href={svc.href}
              className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#111] px-4 py-3 transition-all hover:border-primary/40 active:scale-[0.98]"
            >
              <span aria-hidden="true" className="h-7 w-px bg-primary/80" />
              <span className="flex-1 text-sm font-medium tracking-[0.01em] text-white/80">
                {svc.title}
              </span>
              <svg className="w-4 h-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
