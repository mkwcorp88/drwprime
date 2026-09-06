'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, CalendarOff, Check, CheckCircle2, ChevronDown, Hourglass, Info, Search, Trash2, UserRound, UsersRound, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { dateKeyFromDate, formatDateKey } from '@/lib/treatment-operations/date';
import { roleLabels } from '@/lib/treatment-operations/constants';
import DayOffCalendar from '@/components/treatment-ops/DayOffCalendar';
import type { OpsDayOffPendingView, OpsStaffDayOffView } from '@/types/treatment-operations';

type StaffOption = {
  id: string;
  employeeId: string;
  name: string;
  role: string;
};

type SelectedStaff = StaffOption & { branchId: string | null };

const dayOffStatusStyle: Record<string, string> = {
  PENDING: 'bg-amber-400/15 text-amber-300',
  APPROVED: 'bg-emerald-400/15 text-emerald-300',
  REJECTED: 'bg-rose-400/15 text-rose-300',
};
const dayOffStatusLabel: Record<string, string> = {
  PENDING: 'Menunggu',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
};

export default function StaffDayOffDashboard() {
  const router = useRouter();
  const [todayKey, setTodayKey] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<SelectedStaff | null>(null);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [dayOffs, setDayOffs] = useState<OpsStaffDayOffView[]>([]);
  const [pending, setPending] = useState<OpsDayOffPendingView[]>([]);
  const [canManageAll, setCanManageAll] = useState(false);
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
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
        setPending(data.pending || []);
        setError('');
      })
      .catch(() => { if (active) setError('Gagal memuat jadwal libur.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [router, selectedStaffId]);

  const decideDayOff = async (pendingItem: OpsDayOffPendingView, action: 'APPROVE' | 'REJECT') => {
    setError('');
    setNotice('');
    setDecidingId(pendingItem.id);
    try {
      const response = await fetch(`/api/treatment-ops/day-off/${pendingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) router.replace('/treatment-ops/login');
        setError(data.error || 'Pengajuan tidak dapat diproses.');
        return;
      }
      setPending((current) => current.filter((item) => item.id !== pendingItem.id));
      if (data.dayOff.staffId === selectedStaffId) {
        setDayOffs((current) => [...current, data.dayOff].sort((left, right) => left.date.localeCompare(right.date)));
      }
      setNotice(`Libur ${pendingItem.staff.name} pada ${formatDateKey(dateKeyFromDate(pendingItem.date))} ${action === 'APPROVE' ? 'disetujui' : 'ditolak'}.`);
    } catch {
      setError('Pengajuan tidak dapat diproses.');
    } finally {
      setDecidingId(null);
    }
  };

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
      setNotice(
        canManageAll
          ? `Jadwal libur ${formatDateKey(data.dayOff.date)} berhasil disimpan.`
          : `Pengajuan libur ${formatDateKey(data.dayOff.date)} terkirim dan menunggu persetujuan Super Admin/Manajemen.`,
      );
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
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">{canManageAll
          ? 'Tandai tanggal ketika karyawan tidak bertugas. Pada tanggal tersebut, karyawan otomatis disembunyikan dari pilihan eksekutor order treatment.'
          : 'Ajukan tanggal libur Anda. Pengajuan perlu disetujui Super Admin/Manajemen sebelum berlaku dan menyembunyikan Anda dari pilihan eksekutor.'}</p>
      </section>

      {error && <p className="mt-5 flex items-center justify-between rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200"><span>{error}</span><button onClick={() => setError('')} aria-label="Tutup pesan error"><X className="size-4" /></button></p>}
      {notice && <p className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-200"><CheckCircle2 className="size-4 shrink-0" />{notice}</p>}

      {canManageAll && pending.length > 0 && (
        <section className="mt-6 rounded-3xl border border-amber-400/20 bg-amber-400/[0.05] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5"><span className="flex size-9 items-center justify-center rounded-full bg-amber-400/15 text-amber-300"><Hourglass className="size-4" /></span>
              <div><h2 className="font-playfair text-lg font-bold">Menunggu persetujuan</h2><p className="text-[11px] text-white/45">{pending.length} pengajuan libur karyawan belum diproses.</p></div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {pending.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-black/20 p-3 ring-1 ring-white/10">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{item.staff.name} <span className="font-normal text-white/40">· {item.staff.employeeId}</span></p>
                  <p className="mt-0.5 text-[11px] capitalize text-white/55">{formatDateKey(dateKeyFromDate(item.date))}{item.note ? ` — ${item.note}` : ''}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button disabled={decidingId === item.id} onClick={() => void decideDayOff(item, 'APPROVE')} className="flex h-9 items-center gap-1.5 rounded-full bg-emerald-500/90 px-4 text-xs font-bold text-black transition hover:bg-emerald-400 disabled:opacity-50"><Check className="size-3.5" /> Setujui</button>
                  <button disabled={decidingId === item.id} onClick={() => void decideDayOff(item, 'REJECT')} className="flex h-9 items-center gap-1.5 rounded-full border border-red-400/40 px-4 text-xs font-bold text-red-300 transition hover:bg-red-500 hover:text-white disabled:opacity-50"><X className="size-3.5" /> Tolak</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form onSubmit={saveDayOff} className="fo-glass-card-soft rounded-3xl p-5 sm:p-7">
          <div className="flex items-center gap-3"><CalendarDays className="size-5 text-primary" /><h2 className="font-playfair text-xl font-bold">Tambah tanggal libur</h2></div>
          <p className="mt-2 text-xs leading-5 text-white/45">Buat satu entri untuk setiap tanggal. Tanggal hari ini tetap dapat ditandai.</p>

          {canManageAll && (
            <label className="mt-6 block text-xs font-bold text-white/55">
              Karyawan
              <span className="mt-2 block"><StaffCombobox options={staff} value={selectedStaffId} onChange={(id) => { setSelectedStaffId(id); setNotice(''); }} /></span>
            </label>
          )}

          <label className="mt-6 block text-xs font-bold text-white/55">
            Tanggal libur
            <span className="mt-2 block"><DayOffCalendar value={date} todayKey={todayKey} markedDates={dayOffs.filter((item) => item.status === 'APPROVED').map((item) => item.date)} onSelect={(selected) => { setDate(selected); setNotice(''); }} /></span>
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
              {dayOffs.map((dayOff) => {
                const canDelete = canManageAll || dayOff.status !== 'APPROVED';
                return (
                  <article key={dayOff.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
                    <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary"><span className="text-[9px] font-bold uppercase">{dayOff.date.slice(5, 7)}</span><span className="text-lg font-bold leading-none">{dayOff.date.slice(8, 10)}</span></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold capitalize">{formatDateKey(dayOff.date)}</p>
                      <p className="mt-0.5 truncate text-[11px] text-white/40">{dayOff.note || 'Tidak ada catatan'}</p>
                      {dayOff.approvedBy && dayOff.status === 'APPROVED' && <p className="mt-0.5 text-[10px] text-white/30">Disetujui {dayOff.approvedBy.name}</p>}
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${dayOffStatusStyle[dayOff.status] || 'bg-white/10 text-white/60'}`}>{dayOffStatusLabel[dayOff.status] || dayOff.status}</span>
                    {canDelete && <button disabled={deletingId === dayOff.id} onClick={() => void removeDayOff(dayOff)} className="flex size-9 shrink-0 items-center justify-center rounded-full text-white/35 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40" aria-label={`Hapus jadwal ${formatDateKey(dayOff.date)}`}><Trash2 className="size-4" /></button>}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

function StaffCombobox({ options, value, onChange }: { options: StaffOption[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((member) => member.id === value);
  const normalized = query.trim().toLocaleLowerCase('id-ID');
  const filtered = options.filter((member) =>
    [member.name, member.employeeId, member.role].some((field) => field.toLocaleLowerCase('id-ID').includes(normalized)),
  );

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const choose = (id: string) => {
    onChange(id);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-white/15 bg-black/30 px-4 text-left text-sm text-white outline-none transition hover:border-primary/50 focus:border-primary/60"
      >
        <span className={selected ? 'truncate' : 'truncate text-white/45'}>
          {selected ? `${selected.name} · ${selected.employeeId}` : 'Pilih karyawan'}
        </span>
        <ChevronDown className={`size-4 shrink-0 text-white/45 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-30 overflow-hidden rounded-2xl border border-white/15 bg-[#121212] shadow-2xl shadow-black/50">
          <div className="flex items-center gap-2 border-b border-white/10 px-3">
            <Search className="size-4 shrink-0 text-white/40" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}
              placeholder="Cari nama atau ID karyawan"
              aria-label="Cari karyawan"
              className="h-11 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            />
          </div>
          <div role="listbox" aria-label="Daftar karyawan" className="max-h-64 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <p className="px-3 py-5 text-center text-xs text-white/40">Karyawan tidak ditemukan.</p>
            ) : filtered.map((member) => {
              const roleText = roleLabels[member.role as keyof typeof roleLabels] || member.role;
              return (
                <button
                  key={member.id}
                  type="button"
                  role="option"
                  aria-selected={member.id === value}
                  onClick={() => choose(member.id)}
                  className="flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/10 aria-selected:bg-primary/10"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">{member.name}</span>
                    <span className="mt-0.5 block text-[10px] text-white/45">{member.employeeId} · {roleText}</span>
                  </span>
                  {member.id === value && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
