'use client';

import { useEffect, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { BarChart3, CheckCircle2, Clock3, Coins, Download, ReceiptText, Save, Target, TrendingUp, UsersRound } from 'lucide-react';

type PeriodKey = 'today' | 'week' | 'month' | 'year' | 'custom';
type Report = {
  range: { start: string; end: string };
  summary: { totalOrders: number; completedOrders: number; onProcessOrders: number; cancelledOrders: number; totalRevenue: number; totalIncentive: number; completedActions: number };
  byStatus: Array<{ status: string; count: number }>;
  byTreatment: Array<{ treatmentName: string; orderCount: number; revenue: number }>;
  byTherapist: Array<{ id: string; name: string; employeeId: string; completedActions: number; totalIncentive: number; totalDurationSeconds: number }>;
  trend: Array<{ date: string; orders: number; revenue: number }>;
};
type TargetData = {
  month: string;
  branches: Array<{ id: string; name: string }>;
  targets: Array<{
    id: string;
    branchId: string;
    month: string;
    targetAmount: number;
    updatedAt: string;
    branch: { id: string; name: string };
  }>;
  canManage: boolean;
};

const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: 'today', label: 'Hari Ini' },
  { key: 'week', label: 'Minggu' },
  { key: 'month', label: 'Bulan' },
  { key: 'year', label: 'Tahun' },
  { key: 'custom', label: 'Custom' },
];

const money = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
const compactMoney = (value: number) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}M`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}jt`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}rb`;
  return String(value);
};
const statusLabel: Record<string, string> = {
  DRAFT: 'Draft', CREATED: 'Dibuat', ASSIGNED: 'Ditugaskan', ON_PROCESS: 'Berjalan',
  WAITING_NEXT_ACTION: 'Menunggu', COMPLETED: 'Selesai', VERIFIED: 'Terverifikasi', CANCELLED: 'Dibatalkan',
};

const currentMonthKey = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}`;
};

export default function ReportPage() {
  const [period, setPeriod] = useState<PeriodKey>('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [targetData, setTargetData] = useState<TargetData | null>(null);
  const [targetMonth, setTargetMonth] = useState(currentMonthKey);
  const [targetBranchId, setTargetBranchId] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetLoading, setTargetLoading] = useState(true);
  const [targetError, setTargetError] = useState('');
  const [targetNotice, setTargetNotice] = useState('');
  const [savingTarget, setSavingTarget] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setTargetLoading(true);
    setTargetNotice('');
    const params = new URLSearchParams({ period });
    if (period === 'month') params.set('month', targetMonth);
    if (period === 'custom') {
      if (customStart) params.set('start', customStart);
      if (customEnd) params.set('end', customEnd);
    }
    const targetParams = new URLSearchParams({ month: targetMonth });
    void Promise.all([
      fetch(`/api/treatment-ops/reports/summary?${params}`, { cache: 'no-store' }),
      fetch(`/api/treatment-ops/reports/targets?${targetParams}`, { cache: 'no-store' }),
    ]).then(async ([reportResponse, targetResponse]) => {
      const [data, targets] = await Promise.all([reportResponse.json(), targetResponse.json()]);
      if (!active) return;
      if (!reportResponse.ok) setError(data.error || 'Gagal memuat laporan');
      else { setReport(data); setError(''); }
      if (!targetResponse.ok) setTargetError(targets.error || 'Gagal memuat target omzet.');
      else {
        setTargetData(targets);
        setTargetBranchId((current) => targets.branches.some((branch: { id: string }) => branch.id === current) ? current : targets.branches[0]?.id || '');
        setTargetError('');
      }
      setLoading(false);
      setTargetLoading(false);
    }).catch(() => {
      if (!active) return;
      setError('Gagal memuat laporan');
      setTargetError('Gagal memuat target omzet.');
      setLoading(false);
      setTargetLoading(false);
    });
    return () => { active = false; };
  }, [period, customStart, customEnd, targetMonth]);

  useEffect(() => {
    if (!targetData || !targetBranchId) {
      setTargetAmount('');
      return;
    }
    const current = targetData.targets.find((target) => target.branchId === targetBranchId);
    setTargetAmount(current ? String(current.targetAmount) : '');
  }, [targetBranchId, targetData]);

  const totalTarget = targetData?.targets.reduce((sum, target) => sum + Number(target.targetAmount), 0) || 0;
  const monthlyActual = period === 'month' && report ? report.summary.totalRevenue : null;
  const achievement = monthlyActual !== null && totalTarget > 0 ? Math.round(monthlyActual / totalTarget * 100) : null;
  const targetDifference = monthlyActual !== null ? monthlyActual - totalTarget : null;

  const saveTarget = async (event: React.FormEvent) => {
    event.preventDefault();
    setTargetError('');
    setTargetNotice('');
    const amount = Number(targetAmount);
    if (!targetBranchId) { setTargetError('Cabang wajib dipilih.'); return; }
    if (!Number.isSafeInteger(amount) || amount <= 0) { setTargetError('Target omzet harus berupa angka bulat lebih dari 0.'); return; }
    setSavingTarget(true);
    try {
      const response = await fetch('/api/treatment-ops/reports/targets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: targetMonth, branchId: targetBranchId, targetAmount: amount }),
      });
      const data = await response.json();
      if (!response.ok) { setTargetError(data.error || 'Target omzet tidak dapat disimpan.'); return; }
      const savedTarget = data.target as TargetData['targets'][number];
      setTargetData((current) => current ? {
        ...current,
        targets: [...current.targets.filter((target) => target.branchId !== savedTarget.branchId), savedTarget]
          .sort((left, right) => left.branch.name.localeCompare(right.branch.name, 'id-ID')),
      } : current);
      setTargetAmount(String(savedTarget.targetAmount));
      setTargetNotice(`Target ${savedTarget.branch.name} untuk ${targetMonth} berhasil disimpan.`);
    } catch {
      setTargetError('Target omzet tidak dapat disimpan.');
    } finally {
      setSavingTarget(false);
    }
  };

  const exportCsv = () => {
    if (!report) return;
    const rows = [
      ['Ringkasan Target Omzet', '', '', '', '', ''],
      ['Bulan Target', targetMonth, '', '', '', ''],
      ['Target Omzet', String(totalTarget), '', '', '', ''],
      ['Realisasi Omzet', monthlyActual === null ? 'Pilih periode Bulan untuk membandingkan' : String(monthlyActual), '', '', '', ''],
      ['Pencapaian', achievement === null ? '-' : `${achievement}%`, '', '', '', ''],
      ['', '', '', '', '', ''],
      ['Periode', 'Terapis', 'NIP', 'Tindakan Selesai', 'Durasi (menit)', 'Total Insentif'],
      ...report.byTherapist.map((t) => [period, t.name, t.employeeId, String(t.completedActions), String(Math.round(t.totalDurationSeconds / 60)), String(t.totalIncentive)]),
    ];
    const blob = new Blob([rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `report-drw-prime-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const stats = report ? [
    { label: 'Total Order', value: report.summary.totalOrders, icon: ReceiptText },
    { label: 'Selesai', value: report.summary.completedOrders, icon: CheckCircle2 },
    { label: 'Berjalan', value: report.summary.onProcessOrders, icon: Clock3 },
    { label: 'Omzet', value: money(report.summary.totalRevenue), icon: TrendingUp },
    { label: 'Insentif', value: money(report.summary.totalIncentive), icon: Coins },
    { label: 'Tindakan Selesai', value: report.summary.completedActions, icon: UsersRound },
  ] : [];

  return (
    <div>
      <section className="fo-glass-card rounded-[2rem] p-7 sm:p-9">
        <BarChart3 className="size-8 text-primary" />
        <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Laporan & analitik</p>
        <div className="mt-2 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <h1 className="font-playfair text-4xl font-bold">Report Operasional</h1>
            <p className="mt-2 text-sm text-white/50">Pantau omzet, target bulanan, order, dan insentif dari satu laporan.</p>
          </div>
          <button onClick={exportCsv} className="flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-xs font-bold text-black transition hover:bg-primary-light">
            <Download className="size-4" /> Export CSV
          </button>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-2">
          {PERIODS.map((item) => (
            <button
              key={item.key}
              onClick={() => setPeriod(item.key)}
              className={`rounded-full px-4 py-2 text-xs font-bold transition ${period === item.key ? 'bg-primary text-black' : 'bg-white/5 text-white/60 ring-1 ring-white/15 hover:text-primary'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-xs font-bold text-white/60">Dari<input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="mt-1 block h-11 rounded-xl bg-black/30 px-3 text-sm text-white outline-none ring-1 ring-white/20 focus:ring-primary/60" /></label>
            <label className="text-xs font-bold text-white/60">Sampai<input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="mt-1 block h-11 rounded-xl bg-black/30 px-3 text-sm text-white outline-none ring-1 ring-white/20 focus:ring-primary/60" /></label>
          </div>
        )}
      </section>

      {error && <p className="mt-5 rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}

      {loading ? (
        <div className="py-24 text-center text-sm text-white/50">Memuat laporan...</div>
      ) : report ? (
        <>
           <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
             {stats.map(({ label, value, icon: Icon }) => (
               <div key={label} className="fo-glass-card-soft rounded-3xl p-4 sm:p-5"><Icon className="mb-6 size-5 text-primary" /><p className="truncate text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-white/50">{label}</p></div>
             ))}
           </section>

           <section className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
             <div className="fo-glass-card-soft rounded-3xl p-5 sm:p-6">
               <div className="flex flex-wrap items-start justify-between gap-4">
                 <div className="flex items-start gap-3">
                   <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Target className="size-5" /></span>
                   <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Target keuangan</p><h2 className="font-playfair mt-1 text-xl font-bold">Target omzet bulanan</h2><p className="mt-1 text-xs text-white/45">Realisasi mengikuti omzet order treatment pada periode Bulan.</p></div>
                 </div>
                 <label className="text-[11px] font-bold text-white/50">Bulan
                   <input type="month" value={targetMonth} onChange={(event) => setTargetMonth(event.target.value)} className="mt-1 block h-10 rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white outline-none focus:border-primary/60" />
                 </label>
               </div>
               {targetLoading ? (
                 <p className="mt-5 text-xs text-white/45">Memuat target...</p>
               ) : targetError ? (
                 <p className="mt-5 text-xs text-red-200">{targetError}</p>
               ) : (
                 <>
                   <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                     <div className="rounded-2xl bg-black/20 p-3 ring-1 ring-white/10"><p className="text-[10px] text-white/45">Target</p><p className="mt-1 truncate text-lg font-bold text-primary">{money(totalTarget)}</p></div>
                     <div className="rounded-2xl bg-black/20 p-3 ring-1 ring-white/10"><p className="text-[10px] text-white/45">Realisasi</p><p className="mt-1 truncate text-lg font-bold">{monthlyActual === null ? '-' : money(monthlyActual)}</p></div>
                     <div className="rounded-2xl bg-black/20 p-3 ring-1 ring-white/10"><p className="text-[10px] text-white/45">Pencapaian</p><p className="mt-1 text-lg font-bold text-emerald-300">{achievement === null ? '-' : `${achievement}%`}</p></div>
                   </div>
                   {period !== 'month' && <p className="mt-4 text-[11px] text-white/40">Pilih filter <strong className="text-white/65">Bulan</strong> untuk membandingkan realisasi dengan target {targetMonth}.</p>}
                   {period === 'month' && totalTarget > 0 && (
                     <div className="mt-5">
                       <div className="mb-2 flex items-center justify-between text-[11px] text-white/50"><span>{targetDifference !== null && targetDifference >= 0 ? `Lebih ${money(targetDifference)} dari target` : `Kurang ${money(Math.abs(targetDifference || 0))} dari target`}</span><span className="font-bold text-primary">{achievement}%</span></div>
                       <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${achievement !== null && achievement >= 100 ? 'bg-emerald-400' : 'bg-primary'}`} style={{ width: `${Math.min(100, Math.max(0, achievement || 0))}%` }} /></div>
                     </div>
                   )}
                   {targetData?.targets.length === 0 ? (
                     <p className="mt-4 text-xs text-white/40">Belum ada target untuk {targetMonth}.</p>
                   ) : (
                     <div className="mt-5 space-y-2">
                       {targetData?.targets.map((target) => <div key={target.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.03] px-3 py-2.5 text-xs ring-1 ring-white/10"><span className="truncate text-white/65">{target.branch.name}</span><span className="shrink-0 font-bold text-primary">{money(target.targetAmount)}</span></div>)}
                     </div>
                   )}
                 </>
               )}
             </div>
             {targetData?.canManage && (
               <form onSubmit={saveTarget} className="fo-glass-card-soft rounded-3xl p-5 sm:p-6">
                 <div className="flex items-center gap-2.5"><Save className="size-5 text-primary" /><h2 className="font-playfair text-xl font-bold">Atur target</h2></div>
                 <p className="mt-2 text-xs leading-5 text-white/45">Target disimpan per cabang dan bulan. Finance/Super Admin dapat mengatur semua cabang; Manajemen hanya cabangnya.</p>
                 <div className="mt-5 space-y-3">
                   <Filter label="Cabang"><select required value={targetBranchId} onChange={(event) => setTargetBranchId(event.target.value)}><option value="">Pilih cabang</option>{targetData.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></Filter>
                   <Filter label="Target omzet"><input required type="number" min="1" step="1" inputMode="numeric" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} placeholder="Contoh: 100000000" /></Filter>
                 </div>
                 <button type="submit" disabled={savingTarget || targetLoading || !targetBranchId} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-xs font-bold text-black transition hover:bg-primary-light disabled:opacity-50"><Save className="size-4" />{savingTarget ? 'Menyimpan...' : 'Simpan Target'}</button>
               </form>
             )}
           </section>
           {targetNotice && <p className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs text-emerald-200">{targetNotice}</p>}

           <section className="mt-6 grid gap-3 lg:grid-cols-2">
            <div className="fo-glass-card-soft rounded-3xl p-5">
              <h3 className="mb-4 text-sm font-bold text-white/80">Order per hari</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid rgba(212,175,55,0.4)', borderRadius: 12, color: '#fff' }} labelFormatter={(label) => `Tanggal: ${label}`} />
                    <Bar dataKey="orders" name="Order" fill="#d4af37" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="fo-glass-card-soft rounded-3xl p-5">
              <h3 className="mb-4 text-sm font-bold text-white/80">Omzet per hari</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={report.trend} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                    <defs><linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#d4af37" stopOpacity={0.5} /><stop offset="95%" stopColor="#d4af37" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} tickFormatter={(v) => compactMoney(Number(v))} />
                    <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid rgba(212,175,55,0.4)', borderRadius: 12, color: '#fff' }} formatter={(value) => money(Number(value))} />
                    <Area type="monotone" dataKey="revenue" name="Omzet" stroke="#d4af37" strokeWidth={2} fill="url(#revenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-3 lg:grid-cols-2">
            <div className="fo-glass-card-soft overflow-hidden rounded-3xl">
              <div className="border-b border-white/10 p-5"><h3 className="text-sm font-bold text-white/80">Berdasarkan treatment</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-primary/10 text-primary"><tr><th className="px-4 py-3 font-semibold">Treatment</th><th className="px-4 py-3 font-semibold">Order</th><th className="px-4 py-3 font-semibold">Omzet</th></tr></thead>
                  <tbody>{report.byTreatment.map((item) => <tr key={item.treatmentName} className="border-b border-white/5 bg-white/[0.02]"><td className="px-4 py-3">{item.treatmentName}</td><td className="px-4 py-3">{item.orderCount}</td><td className="px-4 py-3 font-semibold text-primary">{money(item.revenue)}</td></tr>)}</tbody>
                </table>
                {report.byTreatment.length === 0 && <p className="py-10 text-center text-sm text-white/40">Tidak ada data.</p>}
              </div>
            </div>
            <div className="fo-glass-card-soft overflow-hidden rounded-3xl">
              <div className="border-b border-white/10 p-5"><h3 className="text-sm font-bold text-white/80">Performance terapis</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-primary/10 text-primary"><tr><th className="px-4 py-3 font-semibold">Terapis</th><th className="px-4 py-3 font-semibold">Tindakan</th><th className="px-4 py-3 font-semibold">Insentif</th></tr></thead>
                  <tbody>{report.byTherapist.map((item) => <tr key={item.id} className="border-b border-white/5 bg-white/[0.02]"><td className="px-4 py-3 font-semibold">{item.name}<span className="block text-[10px] font-normal text-white/40">{item.employeeId}</span></td><td className="px-4 py-3">{item.completedActions}</td><td className="px-4 py-3 font-semibold text-primary">{money(item.totalIncentive)}</td></tr>)}</tbody>
                </table>
                {report.byTherapist.length === 0 && <p className="py-10 text-center text-sm text-white/40">Tidak ada data.</p>}
              </div>
            </div>
          </section>

          <section className="mt-6">
            <div className="fo-glass-card-soft rounded-3xl p-5">
              <h3 className="mb-4 text-sm font-bold text-white/80">Status order periode ini</h3>
              <div className="flex flex-wrap gap-2">
                {report.byStatus.map((item) => (
                  <span key={item.status} className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/70 ring-1 ring-white/10">{statusLabel[item.status] || item.status}: <strong className="text-primary">{item.count}</strong></span>
                ))}
                {report.byStatus.length === 0 && <span className="text-sm text-white/40">Tidak ada data.</span>}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-[11px] font-bold uppercase tracking-wide text-white/45">{label}<span className="mt-2 block [&_input]:h-10 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-white/15 [&_input]:bg-black/30 [&_input]:px-3 [&_input]:text-sm [&_input]:text-white [&_select]:h-10 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-white/15 [&_select]:bg-black [&_select]:px-3 [&_select]:text-sm [&_select]:text-white">{children}</span></label>;
}
