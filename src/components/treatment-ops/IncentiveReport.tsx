'use client';

import { useEffect, useState } from 'react';
import { CircleDollarSign, Download, WalletCards } from 'lucide-react';

type Entry = { id: string; amount: number; status: string; period: string; therapist: { name: string; employeeId: string }; order: { orderNumber: string; treatmentNameSnapshot: string }; orderAction: { actionNameSnapshot: string; completedAt: string | null } };
const money = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

export default function IncentiveReport() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { void fetch('/api/treatment-ops/incentives').then(async (response) => { const data = await response.json(); if (!response.ok) setError(data.error); else setEntries(data.entries); }); }, []);
  const total = entries.reduce((sum, item) => sum + Number(item.amount), 0);
  const exportCsv = () => {
    const rows = [['Periode', 'Terapis', 'NIP', 'Order', 'Treatment', 'Tindakan', 'Insentif', 'Status'], ...entries.map((entry) => [entry.period, entry.therapist.name, entry.therapist.employeeId, entry.order.orderNumber, entry.order.treatmentNameSnapshot, entry.orderAction.actionNameSnapshot, String(entry.amount), entry.status])];
    const blob = new Blob([rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `insentif-drw-prime-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };
  return (
    <div>
      <section className="fo-glass-card rounded-[2rem] p-7 sm:p-9">
        <WalletCards className="size-8 text-primary" />
        <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Ledger transparan</p>
        <div className="mt-2 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><h1 className="font-playfair text-4xl font-bold">Laporan insentif</h1><p className="mt-2 text-sm text-white/50">Hanya tindakan yang selesai yang masuk perhitungan.</p></div>
          <button onClick={exportCsv} className="flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-xs font-bold text-black transition hover:bg-primary-light"><Download className="size-4" /> Export CSV</button>
        </div>
      </section>
      {error && <p className="mt-5 rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="fo-glass-card-soft rounded-3xl p-5"><CircleDollarSign className="size-5 text-primary" /><p className="mt-6 text-3xl font-bold">{money(total)}</p><p className="mt-1 text-xs text-white/45">Total insentif tercatat</p></div>
        <div className="fo-glass-card-soft rounded-3xl p-5"><p className="text-3xl font-bold">{entries.length}</p><p className="mt-1 text-xs text-white/45">Tindakan selesai</p></div>
        <div className="fo-glass-card-soft rounded-3xl p-5"><p className="text-3xl font-bold">{new Set(entries.map((entry) => entry.therapist.employeeId)).size}</p><p className="mt-1 text-xs text-white/45">Terapis penerima</p></div>
      </section>
      <section className="mt-6 overflow-hidden rounded-3xl ring-1 ring-white/10">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-primary/10 text-primary"><tr>{['Tanggal', 'Terapis', 'Order', 'Tindakan', 'Status', 'Insentif'].map((item) => <th key={item} className="px-4 py-3 font-semibold">{item}</th>)}</tr></thead>
            <tbody>{entries.map((entry) => <tr key={entry.id} className="border-b border-white/5 bg-white/[0.02]"><td className="px-4 py-3 text-white/50">{entry.orderAction.completedAt ? new Date(entry.orderAction.completedAt).toLocaleString('id-ID') : '-'}</td><td className="px-4 py-3 font-semibold">{entry.therapist.name}<span className="block text-[10px] font-normal text-white/40">{entry.therapist.employeeId}</span></td><td className="px-4 py-3">{entry.order.orderNumber}<span className="block text-[10px] text-white/40">{entry.order.treatmentNameSnapshot}</span></td><td className="px-4 py-3">{entry.orderAction.actionNameSnapshot}</td><td className="px-4 py-3"><span className="rounded-full bg-emerald-400/15 px-2 py-1 font-bold text-emerald-300">{entry.status}</span></td><td className="px-4 py-3 font-bold text-primary">{money(Number(entry.amount))}</td></tr>)}</tbody>
          </table>
          {entries.length === 0 && <p className="py-16 text-center text-sm text-white/40">Belum ada insentif yang tercatat.</p>}
        </div>
      </section>
    </div>
  );
}
