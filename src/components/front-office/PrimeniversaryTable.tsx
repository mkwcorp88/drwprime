'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, RefreshCw, Sparkles } from 'lucide-react';

type Entry = {
  id: string; code: string; patientName: string; patientPhone: string; patientEmail: string | null;
  price: number; status: 'pending' | 'active' | 'expired' | 'cancelled';
  createdAt: string; paidAt: string | null; expiresAt: string | null;
};
type Payload = {
  registrations: Entry[];
  summary: { total: number; pending: number; active: number; paidCount: number; paidAmount: number };
  page: number; pageSize: number; filteredTotal: number;
};

const currency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) + ' WIB' : '—';
const statusLabels: Record<Entry['status'], { label: string; style: string }> = {
  pending: { label: 'Menunggu pembayaran', style: 'border-amber-400/30 bg-amber-400/10 text-amber-200' },
  active: { label: 'Aktif', style: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' },
  expired: { label: 'Kedaluwarsa', style: 'border-white/20 bg-white/5 text-white/60' },
  cancelled: { label: 'Dibatalkan', style: 'border-red-400/30 bg-red-400/10 text-red-200' },
};

export default function PrimeniversaryTable() {
  const [data, setData] = useState<Payload | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');
  const sequence = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => { setPage(1); setDebouncedSearch(search); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    const current = ++sequence.current;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ search: debouncedSearch, status, page: String(page) });
      const response = await fetch(`/api/front-office/primeniversary?${params}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal memuat pendaftaran IPL.');
      if (current === sequence.current) setData(result);
    } catch (caught) {
      if (current === sequence.current) setError(caught instanceof Error ? caught.message : 'Gagal memuat pendaftaran IPL.');
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [debouncedSearch, status, page]);

  useEffect(() => {
    const sequenceRef = sequence;
    void load();
    return () => { sequenceRef.current++; };
  }, [load]);

  async function update(entry: Entry, action: 'confirm_payment' | 'cancel') {
    const question = action === 'confirm_payment'
      ? `Pastikan pembayaran ${currency(entry.price)} untuk ${entry.patientName} sudah diterima. Paket akan aktif mulai sekarang selama satu tahun. Lanjutkan?`
      : `Batalkan pendaftaran IPL untuk ${entry.patientName}?`;
    if (!window.confirm(question)) return;
    setBusyId(entry.id);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/front-office/primeniversary', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: entry.id, action }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Pendaftaran belum dapat diperbarui.');
      setMessage(action === 'confirm_payment' ? `Pembayaran ${entry.code} dikonfirmasi; paket aktif selama satu tahun.` : `Pendaftaran ${entry.code} dibatalkan.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Pendaftaran belum dapat diperbarui.');
    } finally {
      setBusyId('');
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.filteredTotal / data.pageSize)) : 1;
  const stat = [
    { label: 'Pendaftar', value: data?.summary.total ?? '—' },
    { label: 'Menunggu pembayaran', value: data?.summary.pending ?? '—' },
    { label: 'Paket aktif', value: data?.summary.active ?? '—' },
    { label: 'Nilai terkonfirmasi', value: data ? currency(data.summary.paidAmount) : '—' },
  ];

  return (
    <section className="fo-glass-card fo-fade-up mt-8 rounded-xl border-primary/35 p-4 sm:p-6" aria-labelledby="ipl-registrations-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/75"><Sparkles size={14} /> Primeniversary 11.11 Celebrate</p><h2 id="ipl-registrations-title" className="mt-2 font-playfair text-2xl font-bold text-white">Pendaftaran IPL 11.11</h2><p className="mt-1 text-sm text-white/55">IPL Sepuasnya · 1 tahun · Rp1.111.000</p></div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/75 hover:border-primary/40 hover:text-primary disabled:opacity-50"><RefreshCw size={14} /> Muat ulang</button>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{stat.map((item) => <div key={item.label} className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-[11px] text-white/50">{item.label}</p><p className="mt-1 text-lg font-semibold text-primary sm:text-xl">{item.value}</p></div>)}</div>
      <p className="mt-2 text-[11px] leading-5 text-white/40">Nilai terkonfirmasi adalah total harga paket yang ditandai terbayar, termasuk paket kedaluwarsa; bukan laporan kas otomatis.</p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row"><label className="sr-only" htmlFor="ipl-search">Cari pendaftar IPL</label><input id="ipl-search" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={100} placeholder="Cari nama, WhatsApp, atau kode" className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-primary focus:outline-none sm:max-w-sm" /><label className="sr-only" htmlFor="ipl-status">Filter status paket</label><select id="ipl-status" value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }} className="rounded-lg border border-white/15 bg-[#171717] px-3 py-2.5 text-sm text-white"><option value="all">Semua status</option><option value="pending">Menunggu pembayaran</option><option value="active">Aktif</option><option value="expired">Kedaluwarsa</option><option value="cancelled">Dibatalkan</option></select></div>
      {error && <p role="alert" className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
      {message && <p role="status" className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</p>}
      <p className="mt-4 text-xs text-white/40 sm:hidden">Geser tabel ke samping untuk melihat semua kolom.</p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-white/50"><tr><th className="px-4 py-3">Kode / tanggal daftar</th><th className="px-4 py-3">Pasien / WhatsApp</th><th className="px-4 py-3">Paket</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Aktif / ED</th><th className="px-4 py-3">Aksi</th></tr></thead>
          <tbody>
            {loading && !data ? <tr><td colSpan={6} className="px-4 py-8 text-center text-white/50">Memuat pendaftaran...</td></tr>
              : !data?.registrations.length ? <tr><td colSpan={6} className="px-4 py-8 text-center text-white/50">{error ? 'Data belum dapat dimuat.' : 'Belum ada pendaftaran yang sesuai.'}</td></tr>
              : data.registrations.map((entry) => <tr key={entry.id} className="border-t border-white/10 align-top"><td className="px-4 py-4"><p className="font-mono text-xs text-primary">{entry.code}</p><p className="mt-1 text-xs text-white/45">{formatDate(entry.createdAt)}</p></td><td className="px-4 py-4"><p className="font-semibold text-white">{entry.patientName}</p><p className="mt-1 text-xs text-white/60">+{entry.patientPhone}</p>{entry.patientEmail && <p className="mt-1 text-xs text-white/40">{entry.patientEmail}</p>}</td><td className="px-4 py-4"><p className="text-white/80">IPL Sepuasnya</p><p className="mt-1 text-xs text-primary">{currency(entry.price)}</p></td><td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] ${statusLabels[entry.status].style}`}>{statusLabels[entry.status].label}</span></td><td className="px-4 py-4 text-xs leading-5 text-white/60"><p>Aktif: {formatDate(entry.paidAt)}</p><p>ED: {formatDate(entry.expiresAt)}</p></td><td className="px-4 py-4"><div className="flex flex-col items-start gap-2"><a href={`https://wa.me/${entry.patientPhone}?text=${encodeURIComponent(`Halo ${entry.patientName}, kami dari DRW Prime ingin menindaklanjuti pendaftaran Primeniversary IPL Sepuasnya Anda (${entry.code}).`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 hover:text-emerald-200"><MessageCircle size={14} /> WhatsApp</a>{entry.status === 'pending' && <><button type="button" onClick={() => void update(entry, 'confirm_payment')} disabled={!!busyId} className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-black disabled:opacity-50">Konfirmasi pembayaran</button><button type="button" onClick={() => void update(entry, 'cancel')} disabled={!!busyId} className="text-xs text-red-300 hover:text-red-200 disabled:opacity-50">Batalkan pendaftaran</button></>}</div></td></tr>)}
          </tbody>
        </table>
      </div>
      {data && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-white/50"><span>{data.filteredTotal} pendaftaran · Halaman {page} dari {totalPages}</span><div className="flex gap-2"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading} className="rounded-lg border border-white/15 px-3 py-2 disabled:opacity-30">Sebelumnya</button><button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || loading} className="rounded-lg border border-white/15 px-3 py-2 disabled:opacity-30">Selanjutnya</button></div></div>}
    </section>
  );
}
