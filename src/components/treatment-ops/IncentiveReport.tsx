'use client';

import { useEffect, useState } from 'react';
import { CircleDollarSign, Download, ShieldCheck, WalletCards } from 'lucide-react';

type Entry = {
  id: string;
  amount: number;
  status: string;
  period: string;
  branch: { id: string; name: string };
  therapist: { id: string; name: string; employeeId: string };
  order: { orderNumber: string; treatmentNameSnapshot: string };
  orderAction: { actionNameSnapshot: string; completedAt: string | null };
};
type Branch = { id: string; name: string };
type Therapist = { id: string; name: string; employeeId: string };
type Filters = { start: string; end: string; branchId: string; therapistId: string; status: string };

const money = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
const statusLabels: Record<string, string> = { PENDING: 'Menunggu', ELIGIBLE: 'Eligible', VERIFIED: 'Terverifikasi', PAID: 'Dibayar', VOID: 'Dibatalkan' };
const statusStyles: Record<string, string> = {
  PENDING: 'bg-slate-400/15 text-slate-200', ELIGIBLE: 'bg-amber-400/15 text-amber-200', VERIFIED: 'bg-sky-400/15 text-sky-200', PAID: 'bg-emerald-400/15 text-emerald-300', VOID: 'bg-red-400/15 text-red-200',
};

export default function IncentiveReport() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [filters, setFilters] = useState<Filters>({ start: new Date().toISOString().slice(0, 8) + '01', end: new Date().toISOString().slice(0, 10), branchId: '', therapistId: '', status: '' });
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    const response = await fetch(`/api/treatment-ops/incentives?${params}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) { setError(data.error || 'Gagal memuat insentif.'); setLoading(false); return; }
    setEntries(data.entries); setBranches(data.branches); setTherapists(data.therapists); setCanManage(data.canManage); setError(''); setLoading(false);
  };

  useEffect(() => { void load(); }, [filters]);

  const total = entries.reduce((sum, item) => sum + Number(item.amount), 0);
  const totalsByStatus = (status: string) => entries.filter((item) => item.status === status).reduce((sum, item) => sum + Number(item.amount), 0);
  const exportCsv = () => {
    const rows = [['Tanggal Selesai', 'Periode', 'Cabang', 'Pekerja', 'NIP', 'Order', 'Treatment', 'Tindakan', 'Insentif', 'Status'], ...entries.map((entry) => [entry.orderAction.completedAt ? new Date(entry.orderAction.completedAt).toLocaleString('id-ID') : '', entry.period, entry.branch.name, entry.therapist.name, entry.therapist.employeeId, entry.order.orderNumber, entry.order.treatmentNameSnapshot, entry.orderAction.actionNameSnapshot, String(entry.amount), statusLabels[entry.status] || entry.status])];
    const blob = new Blob([rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `rekap-insentif-${filters.start || 'semua'}-${filters.end || 'data'}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };
  const updateStatus = async (id: string, status: 'VERIFIED' | 'PAID' | 'VOID') => {
    const reason = status === 'VOID' ? window.prompt('Masukkan alasan pembatalan insentif:')?.trim() : '';
    if (status === 'VOID' && !reason) return;
    setBusyId(id); setError('');
    const response = await fetch(`/api/treatment-ops/incentives/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, reason }) });
    const data = await response.json();
    setBusyId('');
    if (!response.ok) { setError(data.error || 'Status insentif tidak dapat diperbarui.'); return; }
    await load();
  };

  return (
    <div>
      <section className="fo-glass-card rounded-[2rem] p-7 sm:p-9">
        <WalletCards className="size-8 text-primary" />
        <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Rekap seluruh cabang</p>
        <div className="mt-2 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><h1 className="font-playfair text-4xl font-bold">Perhitungan Insentif</h1><p className="mt-2 max-w-2xl text-sm text-white/50">Dasar perhitungan memakai tanggal tindakan selesai. Gunakan rekap ini untuk memverifikasi dan mencatat pembayaran insentif.</p></div>
          <button onClick={exportCsv} disabled={!entries.length} className="flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-xs font-bold text-black transition hover:bg-primary-light disabled:opacity-50"><Download className="size-4" /> Export CSV</button>
        </div>
      </section>
      {error && <p className="mt-5 rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
      <section className="fo-glass-card-soft mt-6 grid gap-3 rounded-3xl p-5 sm:grid-cols-2 lg:grid-cols-5">
        <Filter label="Dari"><input type="date" value={filters.start} onChange={(event) => setFilters({ ...filters, start: event.target.value })} /></Filter>
        <Filter label="Sampai"><input type="date" value={filters.end} onChange={(event) => setFilters({ ...filters, end: event.target.value })} /></Filter>
        <Filter label="Cabang"><select value={filters.branchId} onChange={(event) => setFilters({ ...filters, branchId: event.target.value })}><option value="">Semua cabang</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></Filter>
        <Filter label="Pekerja"><select value={filters.therapistId} onChange={(event) => setFilters({ ...filters, therapistId: event.target.value })}><option value="">Semua pekerja</option>{therapists.map((therapist) => <option key={therapist.id} value={therapist.id}>{therapist.name} ({therapist.employeeId})</option>)}</select></Filter>
        <Filter label="Status"><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">Semua status</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Filter>
      </section>
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat icon={CircleDollarSign} label="Total tercatat" value={money(total)} />
        <Stat label="Tindakan selesai" value={entries.length} />
        <Stat label="Eligible" value={money(totalsByStatus('ELIGIBLE'))} />
        <Stat label="Terverifikasi" value={money(totalsByStatus('VERIFIED'))} />
        <Stat label="Dibayar" value={money(totalsByStatus('PAID'))} />
      </section>
      {canManage && <p className="mt-5 flex items-center gap-2 text-xs text-white/50"><ShieldCheck className="size-4 text-primary" /> Finance dapat memverifikasi, mencatat pembayaran, atau membatalkan insentif dengan alasan audit.</p>}
      <section className="mt-5 overflow-hidden rounded-3xl ring-1 ring-white/10">
        <div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left text-xs">
          <thead className="bg-primary/10 text-primary"><tr>{['Tanggal selesai', 'Cabang', 'Pekerja', 'Order', 'Tindakan', 'Status', 'Insentif', 'Proses'].map((item) => <th key={item} className="px-4 py-3 font-semibold">{item}</th>)}</tr></thead>
          <tbody>{entries.map((entry) => <tr key={entry.id} className="border-b border-white/5 bg-white/[0.02]"><td className="px-4 py-3 text-white/50">{entry.orderAction.completedAt ? new Date(entry.orderAction.completedAt).toLocaleString('id-ID') : '-'}</td><td className="px-4 py-3">{entry.branch.name}</td><td className="px-4 py-3 font-semibold">{entry.therapist.name}<span className="block text-[10px] font-normal text-white/40">{entry.therapist.employeeId}</span></td><td className="px-4 py-3">{entry.order.orderNumber}<span className="block text-[10px] text-white/40">{entry.order.treatmentNameSnapshot}</span></td><td className="px-4 py-3">{entry.orderAction.actionNameSnapshot}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 font-bold ${statusStyles[entry.status] || ''}`}>{statusLabels[entry.status] || entry.status}</span></td><td className="px-4 py-3 font-bold text-primary">{money(Number(entry.amount))}</td><td className="px-4 py-3">{canManage && <Actions entry={entry} busy={busyId === entry.id} onUpdate={updateStatus} />}</td></tr>)}</tbody>
        </table>{!loading && entries.length === 0 && <p className="py-16 text-center text-sm text-white/40">Belum ada tindakan selesai sesuai filter.</p>}{loading && <p className="py-16 text-center text-sm text-white/40">Memuat rekap insentif...</p>}</div>
      </section>
    </div>
  );
}

function Actions({ entry, busy, onUpdate }: { entry: Entry; busy: boolean; onUpdate: (id: string, status: 'VERIFIED' | 'PAID' | 'VOID') => void }) {
  if (entry.status === 'ELIGIBLE') return <div className="flex gap-2"><button disabled={busy} onClick={() => onUpdate(entry.id, 'VERIFIED')} className="rounded-full border border-sky-300/30 px-3 py-1.5 font-bold text-sky-200 disabled:opacity-50">Verifikasi</button><button disabled={busy} onClick={() => onUpdate(entry.id, 'VOID')} className="rounded-full border border-red-300/30 px-3 py-1.5 font-bold text-red-200 disabled:opacity-50">Batalkan</button></div>;
  if (entry.status === 'VERIFIED') return <div className="flex gap-2"><button disabled={busy} onClick={() => onUpdate(entry.id, 'PAID')} className="rounded-full border border-emerald-300/30 px-3 py-1.5 font-bold text-emerald-200 disabled:opacity-50">Tandai dibayar</button><button disabled={busy} onClick={() => onUpdate(entry.id, 'VOID')} className="rounded-full border border-red-300/30 px-3 py-1.5 font-bold text-red-200 disabled:opacity-50">Batalkan</button></div>;
  return null;
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-[11px] font-bold uppercase tracking-wide text-white/45">{label}<span className="mt-2 block [&_input]:h-10 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-white/15 [&_input]:bg-black/30 [&_input]:px-3 [&_input]:text-sm [&_input]:text-white [&_select]:h-10 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-white/15 [&_select]:bg-black [&_select]:px-3 [&_select]:text-sm [&_select]:text-white">{children}</span></label>;
}

function Stat({ icon: Icon, label, value }: { icon?: typeof CircleDollarSign; label: string; value: string | number }) {
  return <div className="fo-glass-card-soft rounded-3xl p-5">{Icon && <Icon className="size-5 text-primary" />}<p className={`${Icon ? 'mt-6' : ''} text-2xl font-bold`}>{value}</p><p className="mt-1 text-xs text-white/45">{label}</p></div>;
}
