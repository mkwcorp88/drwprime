'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

const comparison = {
  beforeSrc: '/before-after/before.webp',
  afterSrc: '/before-after/after.webp',
};

export default function BeforeAfterSection() {
  const [position, setPosition] = useState(50);

  return (
    <section id="before-after" className="bg-black px-5 py-16 font-gilroy md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
          <div className="text-center lg:text-left">
            <div className="mb-4 flex items-center justify-center gap-3 lg:justify-start">
              <span className="h-px w-8 bg-primary" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-primary">
                DRW Prime Results
              </p>
            </div>

            <h2 className="mb-5 text-4xl font-bold tracking-[-0.04em] text-primary md:text-5xl lg:text-6xl">
              Before &amp; After
            </h2>
            <p className="mx-auto max-w-md text-base font-medium leading-7 text-white/65 md:text-lg lg:mx-0">
              Geser garis untuk membandingkan kondisi kulit sebelum dan sesudah perawatan.
            </p>

            <div className="mt-7 flex flex-col items-center gap-4 lg:items-start">
              <Link
                href="/treatments"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:border-primary hover:bg-primary hover:text-black"
              >
                Lihat Semua Treatment
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <p id="before-after-note" className="text-[11px] leading-5 text-white/35">
                Hasil setiap individu dapat berbeda.
              </p>
            </div>
          </div>

          <div className="mx-auto w-full max-w-xl">
            <div className="relative overflow-hidden rounded-[26px] border border-primary/35 bg-[#0c0c0c] p-1.5 shadow-[0_28px_80px_rgba(0,0,0,0.48)]">
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent" />

              <div className="relative aspect-[4/5] select-none overflow-hidden rounded-[21px] bg-[#111]">
                <Image
                  src={comparison.afterSrc}
                  alt="Kondisi kulit setelah perawatan"
                  fill
                  sizes="(min-width: 1024px) 560px, 92vw"
                  className="pointer-events-none object-cover object-[center_38%]"
                  draggable={false}
                />

                <Image
                  src={comparison.beforeSrc}
                  alt="Kondisi kulit sebelum perawatan"
                  fill
                  sizes="(min-width: 1024px) 560px, 92vw"
                  className="pointer-events-none object-cover object-[center_38%]"
                  draggable={false}
                  style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
                />

                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-black/45 to-transparent" />

                <span className="pointer-events-none absolute left-3 top-3 z-20 rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-md">
                  Before
                </span>
                <span className="pointer-events-none absolute right-3 top-3 z-20 rounded-full border border-primary/30 bg-black/55 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary backdrop-blur-md">
                  After
                </span>

                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={position}
                  onChange={(event) => setPosition(Number(event.target.value))}
                  aria-label="Geser untuk membandingkan foto sebelum dan sesudah"
                  aria-valuetext={`${position}% foto sebelum ditampilkan`}
                  aria-describedby="before-after-note"
                  className="peer absolute inset-0 z-30 h-full w-full cursor-ew-resize opacity-0"
                  style={{ touchAction: 'pan-y' }}
                />

                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 z-20 w-px bg-gradient-to-b from-transparent via-primary to-transparent shadow-[0_0_12px_rgba(212,175,55,0.55)]"
                  style={{ left: `${position}%` }}
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 z-40 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-primary/80 bg-black/80 text-primary shadow-[0_0_0_5px_rgba(212,175,55,0.1),0_8px_24px_rgba(0,0,0,0.55)] backdrop-blur-md transition-shadow peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-black"
                  style={{ left: `${position}%` }}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 8l-4 4 4 4M15 8l4 4-4 4" />
                  </svg>
                </div>
              </div>
            </div>

            <p className="mt-3 text-center text-[11px] tracking-wide text-white/35">
              Geser ke kiri atau kanan untuk melihat perbandingan
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
