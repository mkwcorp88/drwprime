'use client';

import Link from "next/link";

const skinIssues = [
  { title: "Jerawat", icon: "●", href: "/treatments?category=facial-basic" },
  { title: "Flek Hitam", icon: "◉", href: "/treatments?category=facial-basic" },
  { title: "Kulit Kusam", icon: "◎", href: "/treatments?category=facial-basic" },
  { title: "Penuaan Dini", icon: "◈", href: "/treatments?category=facial-basic" },
];

const services = [
  {
    title: "Treatment Wajah",
    href: "/treatments?category=facial-basic",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Treatment Tubuh",
    href: "/treatments?category=body-treatment",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
  },
  {
    title: "Home Treatment",
    href: "/home-treatment",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
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
            className="inline-block bg-primary text-dark font-semibold text-sm px-6 py-2.5 rounded-full hover:bg-primary-light transition-colors active:scale-95"
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
              className="flex items-center gap-2.5 bg-[#111] rounded-xl px-3.5 py-3 border border-white/[0.06] hover:border-primary/40 active:scale-[0.98] transition-all"
            >
              <span className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs">
                {issue.icon}
              </span>
              <span className="text-xs font-medium text-white/80">
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
              className="flex items-center gap-3 bg-[#111] rounded-xl px-4 py-3 border border-white/[0.06] hover:border-primary/40 active:scale-[0.98] transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                {svc.icon}
              </div>
              <span className="text-sm font-medium text-white/80 flex-1">
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
