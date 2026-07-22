'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';

type DayResult = {
  visits: number;
  omzet: number;
};

type PerformanceData = {
  date: string;
  visit: DayResult;
  homeTreatment: DayResult;
  generatedAt: string;
};

function getJakartaToday(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value || 0);
}

function formatGeneratedAt(iso: string): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso));
}

const AUTO_REFRESH_MS = 300_000; // 5 minutes

export default function PerformancePage() {
  const today = getJakartaToday();
  const [selectedDate, setSelectedDate] = useState(today);
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (date: string, signal?: AbortSignal) => {
    setError('');
    setLoading(true);

    try {
      const params = new URLSearchParams({ date });
      const res = await fetch(`/api/front-office/performance?${params}`, {
        signal,
        cache: 'no-store',
      });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Gagal memuat data performance.');
      }

      setData(result);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setError(caught instanceof Error ? caught.message : 'Gagal memuat data performance.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(selectedDate, controller.signal);
    return () => controller.abort();
  }, [selectedDate, fetchData]);

  // Auto-refresh
  useEffect(() => {
    const tick = () => {
      fetchData(selectedDate);
    };
    intervalRef.current = setInterval(tick, AUTO_REFRESH_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedDate, fetchData]);

  const showEmpty = data && data.visit.visits === 0 && data.visit.omzet === 0 &&
    data.homeTreatment.visits === 0 && data.homeTreatment.omzet === 0;

  return (
    <div className="min-h-screen fo-glass-page fo-theme-performance">
      <div className="mx-auto max-w-[1440px] px-4 pb-14 pt-20 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="fo-fade-up">
            <h1 className="text-2xl font-bold text-white">Performance</h1>
            <p className="mt-1 text-sm text-white/50">Rekap harian Visit Klinik &amp; Home Treatment</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 fo-fade-up fo-stagger-1">
            {data && (
              <p className="text-[10px] text-white/35 whitespace-nowrap">
                Sinkron <span className="text-white/55">{formatGeneratedAt(data.generatedAt)} WIB</span>
              </p>
            )}
            <button
              type="button"
              onClick={() => fetchData(selectedDate)}
              disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-200 hover:border-cyan-300/30 hover:bg-cyan-300/15 disabled:cursor-wait disabled:opacity-60"
              aria-label="Perbarui data"
            >
              <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v5h.58m14.84 2A7.5 7.5 0 004.58 9m0 0H9m11 11v-5h-.58m0 0A7.5 7.5 0 014.58 13m14.84 2H15" />
              </svg>
            </button>
            <Link href="/front-office" className="fo-nav-chip text-sm">
              Dashboard
            </Link>
          </div>
        </div>

        {/* Date Picker */}
        <div className="fo-glass-card fo-fade-up fo-stagger-1 mt-5 flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center">
          <label className="flex items-center gap-3">
            <svg className="h-4 w-4 text-cyan-300/70 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3M5 11h14M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
            </svg>
            <span className="text-xs font-medium text-white/50 whitespace-nowrap">Pilih tanggal</span>
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="fo-glass-input rounded-lg px-3 py-2 text-sm [color-scheme:dark]"
            />
          </label>
          <button
            type="button"
            onClick={() => setSelectedDate(today)}
            className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/20"
          >
            Hari ini
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200" role="alert">
            <svg className="h-5 w-5 shrink-0 text-rose-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v4m0 4h.01M10.3 3.7L2.6 17a2 2 0 001.73 3h15.34a2 2 0 001.73-3L13.7 3.7a2 2 0 00-3.4 0z" />
            </svg>
            <span className="flex-1">{error}</span>
            <button onClick={() => fetchData(selectedDate)} className="rounded-lg border border-rose-300/25 px-3 py-1.5 text-xs font-semibold hover:bg-rose-300/10">
              Coba lagi
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !data && (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {['Home Treatment', 'Visit Klinik'].map((label) => (
              <div key={label} className="fo-glass-card animate-pulse rounded-2xl p-5 sm:p-6">
                <div className="mb-5 h-4 w-28 rounded bg-white/10" />
                <div className="mb-2 h-9 w-36 rounded bg-white/10" />
                <div className="h-3 w-44 rounded bg-white/10" />
              </div>
            ))}
          </div>
        )}

        {/* Two tables */}
        {data && (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {/* Home Treatment */}
            <section className="fo-glass-card fo-fade-up rounded-2xl overflow-hidden">
              <div className="border-b border-white/10 fo-glass-card-soft flex items-center justify-between px-5 py-4 sm:px-6">
                <h2 className="font-semibold text-white">Home Treatment</h2>
                <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {selectedDate}
                </span>
              </div>

              {showEmpty ? (
                <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
                  <svg className="mb-3 h-8 w-8 text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-sm font-medium text-white/30">Belum ada laporan</p>
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  <div className="flex items-center justify-between px-5 py-5 sm:px-6">
                    <div>
                      <p className="text-xs uppercase tracking-[0.1em] text-white/40">Kunjungan</p>
                      <p className="mt-1 text-4xl font-bold text-white">{formatNumber(data.homeTreatment.visits)}</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10">
                      <svg className="h-6 w-6 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2m7-10a4 4 0 100-8 4 4 0 000 8zm13 10v-2a4 4 0 00-3-3.87m-2-12a4 4 0 010 7.75" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-5 py-5 sm:px-6">
                    <div>
                      <p className="text-xs uppercase tracking-[0.1em] text-white/40">Omzet</p>
                      <p className="mt-1 text-3xl font-bold text-emerald-300">{formatCurrency(data.homeTreatment.omzet)}</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10">
                      <svg className="h-6 w-6 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v12m3-9.5c0-1.38-1.34-2.5-3-2.5S9 7.12 9 8.5s1.34 2.5 3 2.5 3 1.12 3 2.5S13.66 17 12 17s-3-1.12-3-2.5" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Visit Klinik */}
            <section className="fo-glass-card fo-fade-up fo-stagger-1 rounded-2xl overflow-hidden">
              <div className="border-b border-white/10 fo-glass-card-soft flex items-center justify-between px-5 py-4 sm:px-6">
                <h2 className="font-semibold text-white">Visit Klinik</h2>
                <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {selectedDate}
                </span>
              </div>

              {showEmpty ? (
                <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
                  <svg className="mb-3 h-8 w-8 text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m4 0h10" />
                  </svg>
                  <p className="text-sm font-medium text-white/30">Belum ada laporan</p>
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  <div className="flex items-center justify-between px-5 py-5 sm:px-6">
                    <div>
                      <p className="text-xs uppercase tracking-[0.1em] text-white/40">Kunjungan</p>
                      <p className="mt-1 text-4xl font-bold text-white">{formatNumber(data.visit.visits)}</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10">
                      <svg className="h-6 w-6 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2m7-10a4 4 0 100-8 4 4 0 000 8zm13 10v-2a4 4 0 00-3-3.87m-2-12a4 4 0 010 7.75" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-5 py-5 sm:px-6">
                    <div>
                      <p className="text-xs uppercase tracking-[0.1em] text-white/40">Omzet</p>
                      <p className="mt-1 text-3xl font-bold text-emerald-300">{formatCurrency(data.visit.omzet)}</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10">
                      <svg className="h-6 w-6 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v12m3-9.5c0-1.38-1.34-2.5-3-2.5S9 7.12 9 8.5s1.34 2.5 3 2.5 3 1.12 3 2.5S13.66 17 12 17s-3-1.12-3-2.5" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* Footer note */}
        <p className="mt-6 text-center text-[10px] text-white/20">
          Data disinkronkan dari Google Sheets setiap 5 menit. Tekan ikon refresh untuk pembaruan instan.
        </p>
      </div>
    </div>
  );
}
