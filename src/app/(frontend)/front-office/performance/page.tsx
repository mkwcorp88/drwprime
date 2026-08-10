'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

// --------------- types ---------------

type DayResult = { visits: number; omzet: number };
type DayEntry = { date: string; visit: DayResult; homeTreatment: DayResult };
type PerformanceData = { date: string; visit: DayResult; homeTreatment: DayResult; generatedAt: string };
type RangeData = { range: string; date: string; days: DayEntry[]; generatedAt: string };

type ViewMode = 'daily' | 'weekly' | 'monthly';

// --------------- helpers ---------------

function getJakartaToday(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const d = parts.find(p => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value || 0);
}

function formatGeneratedAt(iso: string): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(iso));
}

function shortDate(dateKey: string): string {
  const [, m, d] = dateKey.split('-');
  return `${d}/${m}`;
}

function dayLabel(dateKey: string): string {
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const [y, m, d] = dateKey.split('-').map(Number);
  const dIdx = new Date(y, m - 1, d).getDay();
  return `${days[dIdx]} ${d}/${m}`;
}

const omzetConfig = {
  visit: { label: 'Visit Klinik', color: '#22d3ee' },
  ht: { label: 'Home Treatment', color: '#a78bfa' },
};

const visitConfig = {
  visit: { label: 'Visit Klinik', color: '#22d3ee' },
  ht: { label: 'Home Treatment', color: '#a78bfa' },
};

const AUTO_REFRESH_MS = 300_000;

// --------------- component ---------------

export default function PerformancePage() {
  const today = getJakartaToday();
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [selectedDate, setSelectedDate] = useState(today);
  const [dailyData, setDailyData] = useState<PerformanceData | null>(null);
  const [rangeData, setRangeData] = useState<RangeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  // --------------- fetch ---------------

  const fetchData = useCallback(async (mode: ViewMode, date: string, silent = false) => {
    if (silent && requestRef.current) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    if (!silent) setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({ date });
      if (mode === 'weekly') params.set('range', '7d');
      else if (mode === 'monthly') params.set('range', '30d');

      const res = await fetch(`/api/front-office/performance?${params}`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Gagal memuat data.');

      if (mode === 'weekly' || mode === 'monthly') {
        setRangeData(result);
        setDailyData(null);
      } else {
        setDailyData(result);
        setRangeData(null);
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setError(caught instanceof Error ? caught.message : 'Gagal memuat data.');
    } finally {
      if (requestRef.current === controller) {
        if (!silent) setLoading(false);
        requestRef.current = null;
      }
    }
  }, []);

  // Initial + mode/date change
  useEffect(() => {
    fetchData(viewMode, selectedDate);
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [viewMode, selectedDate, fetchData]);

  // Auto-refresh
  useEffect(() => {
    intervalRef.current = setInterval(() => fetchData(viewMode, selectedDate, true), AUTO_REFRESH_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [viewMode, selectedDate, fetchData]);

  // --------------- derived ---------------

  const switchMode = (mode: ViewMode) => {
    if (mode !== viewMode) {
      setDailyData(null);
      setRangeData(null);
      setViewMode(mode);
    }
  };

  const rangeLabel = viewMode === 'weekly' ? '7 hari' : viewMode === 'monthly' ? '30 hari' : '';

  const showEmptyDaily = dailyData
    ? dailyData.visit.visits === 0 && dailyData.visit.omzet === 0 &&
      dailyData.homeTreatment.visits === 0 && dailyData.homeTreatment.omzet === 0
    : false;

  // Chart data
  const chartData = rangeData?.days.map(d => ({
    date: d.date,
    label: viewMode === 'weekly' ? dayLabel(d.date) : shortDate(d.date),
    visitVisits: d.visit.visits,
    visitOmzet: d.visit.omzet,
    htVisits: d.homeTreatment.visits,
    htOmzet: d.homeTreatment.omzet,
  })) ?? [];

  const totalVisits = chartData.reduce((s, d) => s + d.visitVisits + d.htVisits, 0);
  const totalOmzet = chartData.reduce((s, d) => s + d.visitOmzet + d.htOmzet, 0);
  const avgDayVisits = chartData.length ? Math.round(totalVisits / chartData.length) : 0;
  const daysWithActivity = chartData.filter(d => d.visitVisits + d.htVisits > 0).length;

  // --------------- render ---------------

  return (
    <div className="min-h-screen fo-glass-page fo-theme-performance">
      <div className="mx-auto max-w-[1440px] px-4 pb-14 pt-20 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="fo-fade-up">
            <h1 className="text-2xl font-bold text-white">Performance</h1>
            <p className="mt-1 text-sm text-white/50">
              {viewMode === 'daily' ? 'Rekap harian Visit Klinik & Home Treatment' :
               viewMode === 'weekly' ? 'Tren 7 hari terakhir' : 'Tren 30 hari terakhir'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 fo-fade-up fo-stagger-1">
            {(dailyData || rangeData) && (
              <p className="text-[10px] text-white/35 whitespace-nowrap">
                Sinkron <span className="text-white/55">{formatGeneratedAt((dailyData ?? rangeData)!.generatedAt)} WIB</span>
              </p>
            )}
            <button
              type="button"
              onClick={() => fetchData(viewMode, selectedDate)}
              disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-200 hover:border-cyan-300/30 hover:bg-cyan-300/15 disabled:cursor-wait disabled:opacity-60"
              aria-label="Perbarui data"
            >
              <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v5h.58m14.84 2A7.5 7.5 0 004.58 9m0 0H9m11 11v-5h-.58m0 0A7.5 7.5 0 014.58 13m14.84 2H15" />
              </svg>
            </button>
            <Link href="/front-office" className="fo-nav-chip text-sm">Dashboard</Link>
          </div>
        </div>

        {/* View Switcher */}
        <div className="fo-fade-up fo-stagger-1 mt-5 flex flex-wrap items-center gap-2">
          {(['daily', 'weekly', 'monthly'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => switchMode(mode)}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                viewMode === mode
                  ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-300'
                  : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {mode === 'daily' ? 'Harian' : mode === 'weekly' ? 'Mingguan' : 'Bulanan'}
            </button>
          ))}
        </div>

        {/* Date Picker — daily mode only */}
        {viewMode === 'daily' && (
          <div className="fo-glass-card fo-fade-up fo-stagger-1 mt-4 flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center">
            <label className="flex items-center gap-3">
              <svg className="h-4 w-4 text-cyan-300/70 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3M5 11h14M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" /></svg>
              <span className="text-xs font-medium text-white/50">Pilih tanggal</span>
              <input type="date" value={selectedDate} max={today} onChange={e => setSelectedDate(e.target.value)} className="fo-glass-input rounded-lg px-3 py-2 text-sm [color-scheme:dark]" />
            </label>
            <button onClick={() => setSelectedDate(today)} className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20">Hari ini</button>
          </div>
        )}

        {/* Date Picker — range mode */}
        {(viewMode === 'weekly' || viewMode === 'monthly') && (
          <div className="fo-glass-card fo-fade-up fo-stagger-1 mt-4 flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center">
            <label className="flex items-center gap-3">
              <svg className="h-4 w-4 text-cyan-300/70 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3M5 11h14M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" /></svg>
              <span className="text-xs font-medium text-white/50">Berakhir tanggal</span>
              <input type="date" value={selectedDate} max={today} onChange={e => setSelectedDate(e.target.value)} className="fo-glass-input rounded-lg px-3 py-2 text-sm [color-scheme:dark]" />
            </label>
            <button onClick={() => setSelectedDate(today)} className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20">Hari ini</button>
            <span className="text-xs text-white/40">{rangeLabel} ke belakang</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200" role="alert">
            <svg className="h-5 w-5 shrink-0 text-rose-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v4m0 4h.01M10.3 3.7L2.6 17a2 2 0 001.73 3h15.34a2 2 0 001.73-3L13.7 3.7a2 2 0 00-3.4 0z" /></svg>
            <span className="flex-1">{error}</span>
            <button onClick={() => fetchData(viewMode, selectedDate)} className="rounded-lg border border-rose-300/25 px-3 py-1.5 text-xs font-semibold hover:bg-rose-300/10">Coba lagi</button>
          </div>
        )}

        {/* Loading */}
        {loading && !dailyData && !rangeData && (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {['Home Treatment', 'Visit Klinik'].map(label => (
              <div key={label} className="fo-glass-card animate-pulse rounded-2xl p-5 sm:p-6">
                <div className="mb-5 h-4 w-28 rounded bg-white/10" />
                <div className="mb-2 h-9 w-36 rounded bg-white/10" />
                <div className="h-3 w-44 rounded bg-white/10" />
              </div>
            ))}
          </div>
        )}

        {/* ===== DAILY VIEW ===== */}
        {viewMode === 'daily' && dailyData && (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <DayCard title="Home Treatment" date={selectedDate} result={dailyData.homeTreatment} showEmpty={showEmptyDaily} />
            <DayCard title="Visit Klinik" date={selectedDate} result={dailyData.visit} showEmpty={showEmptyDaily} />
          </div>
        )}

        {/* ===== RANGE VIEW (weekly / monthly) ===== */}
        {(viewMode === 'weekly' || viewMode === 'monthly') && rangeData && (
          <div className="mt-5 space-y-5">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryCard label="Total Omzet" value={formatCurrency(totalOmzet)} color="emerald" />
              <SummaryCard label="Total Kunjungan" value={formatNumber(totalVisits)} color="cyan" />
              <SummaryCard label="Rata² / Hari" value={formatNumber(avgDayVisits)} color="violet" />
              <SummaryCard label="Hari Aktif" value={`${daysWithActivity}/${chartData.length}`} color="amber" />
            </div>

            {/* Omzet chart */}
            <Card className="fo-glass-card border-white/10 bg-transparent">
              <CardHeader>
                <CardTitle className="text-white text-base">Omzet</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <p className="py-8 text-center text-sm text-white/30">Belum ada data</p>
                ) : (
                  <ChartContainer config={omzetConfig} className="h-[300px] w-full">
                    <BarChart accessibilityLayer data={chartData}>
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent indicator="dashed" />} />
                      <Bar dataKey="visitOmzet" fill="#22d3ee" radius={[4, 4, 0, 0]} name="Visit Klinik" />
                      <Bar dataKey="htOmzet" fill="#a78bfa" radius={[4, 4, 0, 0]} name="Home Treatment" />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Visits chart */}
            <Card className="fo-glass-card border-white/10 bg-transparent">
              <CardHeader>
                <CardTitle className="text-white text-base">Kunjungan</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <p className="py-8 text-center text-sm text-white/30">Belum ada data</p>
                ) : (
                  <ChartContainer config={visitConfig} className="h-[300px] w-full">
                    <BarChart accessibilityLayer data={chartData}>
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent indicator="dashed" />} />
                      <Bar dataKey="visitVisits" fill="#22d3ee" radius={[4, 4, 0, 0]} name="Visit Klinik" />
                      <Bar dataKey="htVisits" fill="#a78bfa" radius={[4, 4, 0, 0]} name="Home Treatment" />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Table detail */}
            <Card className="fo-glass-card border-white/10 bg-transparent">
              <CardHeader>
                <CardTitle className="text-white text-base">Detail per Tanggal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-white/40 text-xs uppercase">
                        <th className="px-3 py-2">Tanggal</th>
                        <th className="px-3 py-2 text-right">Visit</th>
                        <th className="px-3 py-2 text-right">HT</th>
                        <th className="px-3 py-2 text-right">Omzet Visit</th>
                        <th className="px-3 py-2 text-right">Omzet HT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chartData.map(d => (
                        <tr key={d.date} className="border-t border-white/5 hover:bg-white/5">
                          <td className="px-3 py-2 text-white/70 font-mono text-xs">{d.label}</td>
                          <td className="px-3 py-2 text-right text-white">{d.visitVisits || '-'}</td>
                          <td className="px-3 py-2 text-right text-white">{d.htVisits || '-'}</td>
                          <td className="px-3 py-2 text-right text-emerald-400">{d.visitOmzet ? formatCurrency(d.visitOmzet) : '-'}</td>
                          <td className="px-3 py-2 text-right text-emerald-400">{d.htOmzet ? formatCurrency(d.htOmzet) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Footer */}
        <p className="mt-6 text-center text-[10px] text-white/20">
          Data disinkronkan dari Google Sheets setiap 5 menit. Tekan ikon refresh untuk pembaruan instan.
        </p>
      </div>
    </div>
  );
}

// --------------- sub-components ---------------

function DayCard({ title, date, result, showEmpty }: { title: string; date: string; result: DayResult; showEmpty: boolean }) {
  return (
    <section className="fo-glass-card fo-fade-up rounded-2xl overflow-hidden">
      <div className="border-b border-white/10 fo-glass-card-soft flex items-center justify-between px-5 py-4 sm:px-6">
        <h2 className="font-semibold text-white">{title}</h2>
        <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{date}</span>
      </div>
      {showEmpty ? (
        <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
          <svg className="mb-3 h-8 w-8 text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
          <p className="text-sm font-medium text-white/30">Belum ada laporan</p>
        </div>
      ) : (
        <div className="divide-y divide-white/10">
          <StatRow label="Kunjungan" value={formatNumber(result.visits)} icon="users" color="cyan" />
          <StatRow label="Omzet" value={formatCurrency(result.omzet)} icon="money" color="emerald" />
        </div>
      )}
    </section>
  );
}

function StatRow({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  const colorMap: Record<string, { border: string; bg: string; text: string }> = {
    cyan: { border: 'border-cyan-400/20', bg: 'bg-cyan-400/10', text: 'text-cyan-300' },
    emerald: { border: 'border-emerald-400/20', bg: 'bg-emerald-400/10', text: 'text-emerald-300' },
  };
  const c = colorMap[color] ?? colorMap.cyan;
  return (
    <div className="flex items-center justify-between px-5 py-5 sm:px-6">
      <div>
        <p className="text-xs uppercase tracking-[0.1em] text-white/40">{label}</p>
        <p className={`mt-1 text-3xl font-bold ${color === 'emerald' ? 'text-emerald-300' : 'text-white'}`}>{value}</p>
      </div>
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${c.border} ${c.bg}`}>
        {icon === 'users' ? (
          <svg className={`h-6 w-6 ${c.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2m7-10a4 4 0 100-8 4 4 0 000 8zm13 10v-2a4 4 0 00-3-3.87m-2-12a4 4 0 010 7.75" /></svg>
        ) : (
          <svg className={`h-6 w-6 ${c.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v12m3-9.5c0-1.38-1.34-2.5-3-2.5S9 7.12 9 8.5s1.34 2.5 3 2.5 3 1.12 3 2.5S13.66 17 12 17s-3-1.12-3-2.5" /></svg>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'border-emerald-500/35 text-emerald-400',
    cyan: 'border-cyan-500/35 text-cyan-400',
    violet: 'border-violet-500/35 text-violet-400',
    amber: 'border-amber-500/35 text-amber-400',
  };
  const c = colorMap[color] ?? colorMap.emerald;
  return (
    <div className={`fo-glass-card rounded-xl p-4 border ${c.split(' ')[0]}`}>
      <p className="text-white/40 text-xs">{label}</p>
      <p className={`mt-1 text-xl font-bold ${c.split(' ')[1]}`}>{value}</p>
    </div>
  );
}
