'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, CalendarOff, CheckCircle2, Info, Trash2, UserRound, UsersRound, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { dateKeyFromDate, formatDateKey } from '@/lib/treatment-operations/date';
import { roleLabels } from '@/lib/treatment-operations/constants';
import type { OpsStaffDayOffView } from '@/types/treatment-operations';

type StaffOption = {
  id: string;
  employeeId: string;
  name: string;
  role: string;
};

type SelectedStaff = StaffOption & { branchId: string | null };

export default function StaffDayOffDashboard() {
  const router = useRouter();
  const [todayKey, setTodayKey] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<SelectedStaff | null>(null);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [dayOffs, setDayOffs] = useState<OpsStaffDayOffView[]>([]);
  const [canManageAll, setCanManageAll] = useState(false);
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const current = dateKeyFromDate(new Date());
    setTodayKey(current);
    setDate(current);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const query = selectedStaffId ? `?staffId=${encodeURIComponent(selectedStaffId)}` : '';
    void fetch(`/api/treatment-ops/day-off${query}`, { cache: 'no-store' })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!active) return;
        if (response.status === 401) { router.replace('/treatment-ops/login'); return; }
        if (!response.ok) { setError(data.error || 'Gagal memuat jadwal libur.'); return; }
        setCanManageAll(Boolean(data.canManageAll));
        setStaff(data.staff || []);
        setSelectedStaff(data.selectedStaff || null);
        setSelectedStaffId((current) => current || data.selectedStaffId || '');
        setDayOffs(data.dayOffs || []);
        setError('');
      })
      .catch(() => { if (active) setError('Gagal memuat jadwal libur.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [router, selectedStaffId]);

  const saveDayOff = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!date) { setError('Tanggal libur wajib dipilih.'); return; }
    if (canManageAll && !selectedStaffId) { setError('Pilih karyawan terlebih dahulu.'); return; }
    setSaving(true);
    try {
      const response = await fetch('/api/treatment-ops/day-off', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, note, ...(canManageAll ? { staffId: selectedStaffId } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) router.replace('/treatment-ops/login');
        setError(data.error || 'Jadwal libur tidak dapat disimpan.');
        return;
      }
      setDayOffs((current) => [...current, data.dayOff].sort((left, right) => left.date.localeCompare(right.date)));
      setNote('');
      setNotice(`Jadwal libur ${formatDateKey(data.dayOff.date)} berhasil disimpan.`);
    } catch {
      setError('Jadwal libur tidak dapat disimpan.');
    } finally {
      setSaving(false);
    }
  };

  const removeDayOff = async (dayOff: OpsStaffDayOffView) => {
    if (!window.confirm(`Hapus jadwal libur ${formatDateKey(dayOff.date)}?`)) return;
    setError('');
    setNotice('');
    setDeletingId(dayOff.id);
    try {
      const response = await fetch(`/api/treatment-ops/day-off/${dayOff.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) router.replace('/treatment-ops/login');
        setError(data.error || 'Jadwal libur tidak dapat dihapus.');
        return;
      }
      setDayOffs((current) => current.filter((item) => item.id !== dayOff.id));
      setNotice('Jadwal libur berhasil dihapus.');
    } catch {
      setError('Jadwal libur tidak dapat dihapus.');
    } finally {
      setDeletingId(null);
    }
  };

  const selectedName = selectedStaff?.name || 'Saya';
  const selectedRole = selectedStaff ? (roleLabels[selectedStaff.role as keyof typeof roleLabels] || selectedStaff.role) : '';

  if (loading) return <div className="py-24 text-center text-sm text-white/50">Memuat jadwal libur...</div>;

  return (
    <div>
      <section className="fo-glass-card rounded-[2rem] p-7 sm:p-9">
        <CalendarOff className="size-8 text-primary" />
        <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Perencanaan tim</p>
        <h1 className="font-playfair mt-2 text-4xl font-bold">Jadwal Libur</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">Tandai tanggal ketika karyawan tidak bertugas. Pada tanggal tersebut, karyawan otomatis disembunyikan dari pilihan eksekutor order treatment.</p>
      </section>

      {error && <p className="mt-5 flex items-center justify-between rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200"><span>{error}</span><button onClick={() => setError('')} aria-label="Tutup pesan error"><X className="size-4" /></button></p>}
      {notice && <p className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-200"><CheckCircle2 className="size-4 shrink-0" />{notice}</p>}

      <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form onSubmit={saveDayOff} className="fo-glass-card-soft rounded-3xl p-5 sm:p-7">
          <div className="flex items-center gap-3"><CalendarDays className="size-5 text-primary" /><h2 className="font-playfair text-xl font-bold">Tambah tanggal libur</h2></div>
          <p className="mt-2 text-xs leading-5 text-white/45">Buat satu entri untuk setiap tanggal. Tanggal hari ini tetap dapat ditandai.</p>

          {canManageAll && (
            <label className="mt-6 block text-xs font-bold text-white/55">
              Karyawan
              <span className="mt-2 block">
                <select value={selectedStaffId} onChange={(event) => { setSelectedStaffId(event.target.value); setNotice(''); }} className="h-12 w-full rounded-xl border border-white/15 bg-black/30 px-4 text-sm text-white outline-none focus:border-primary/60">
                  <option value="">Pilih karyawan</option>
                  {staff.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.employeeId}</option>)}
                </select>
              </span>
            </label>
          )}

          <label className="mt-6 block text-xs font-bold text-white/55">
            Tanggal libur
            <span className="mt-2 block"><input required type="date" min={todayKey || undefined} value={date} onChange={(event) => setDate(event.target.value)} className="h-12 w-full rounded-xl border border-white/15 bg-black/30 px-4 text-sm text-white outline-none focus:border-primary/60" /></span>
          </label>
          <label className="mt-4 block text-xs font-bold text-white/55">
            Catatan <span className="font-normal text-white/35">(opsional)</span>
            <span className="mt-2 block"><input maxLength={240} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Cuti, keperluan pribadi, atau alasan lain" className="h-12 w-full rounded-xl border border-white/15 bg-black/30 px-4 text-sm text-white outline-none placeholder:text-white/30 focus:border-primary/60" /></span>
          </label>
          <button disabled={saving || !todayKey || (canManageAll && !selectedStaffId)} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-black transition hover:bg-primary-light disabled:opacity-50">
            <CalendarOff className="size-4" />{saving ? 'Menyimpan...' : 'Simpan Jadwal Libur'}
          </button>
        </form>

        <section className="fo-glass-card-soft rounded-3xl p-5 sm:p-7">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Jadwal aktif</p>
              <h2 className="font-playfair mt-1 text-2xl font-bold">{selectedName}</h2>
              <p className="mt-1 text-xs text-white/45">{selectedRole || 'Tanggal libur saya'}{selectedStaff?.employeeId ? ` · ${selectedStaff.employeeId}` : ''}</p>
            </div>
            <span className="flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-[10px] font-bold text-primary"><UsersRound className="size-3.5" /> {dayOffs.length} tanggal</span>
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-2xl border border-primary/15 bg-primary/[0.06] p-3 text-[11px] leading-5 text-white/55"><Info className="mt-0.5 size-4 shrink-0 text-primary" /><span>Jadwal ini hanya berlaku untuk tanggal yang dipilih. Assignment lama tidak dihapus otomatis, tetapi karyawan yang sedang libur tidak dapat memulai tindakan baru.</span></div>

          {dayOffs.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-white/15 px-5 py-12 text-center"><UserRound className="mx-auto size-7 text-white/25" /><p className="mt-3 text-sm text-white/45">Belum ada jadwal libur.</p><p className="mt-1 text-xs text-white/30">Tambahkan tanggal pertama dari formulir di samping.</p></div>
          ) : (
            <div className="mt-5 space-y-2">
              {dayOffs.map((dayOff) => (
                <article key={dayOff.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
                  <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary"><span className="text-[9px] font-bold uppercase">{dayOff.date.slice(5, 7)}</span><span className="text-lg font-bold leading-none">{dayOff.date.slice(8, 10)}</span></div>
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold capitalize">{formatDateKey(dayOff.date)}</p><p className="mt-0.5 truncate text-[11px] text-white/40">{dayOff.note || 'Tidak ada catatan'}</p></div>
                  <button disabled={deletingId === dayOff.id} onClick={() => void removeDayOff(dayOff)} className="flex size-9 shrink-0 items-center justify-center rounded-full text-white/35 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40" aria-label={`Hapus jadwal ${formatDateKey(dayOff.date)}`}><Trash2 className="size-4" /></button>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
