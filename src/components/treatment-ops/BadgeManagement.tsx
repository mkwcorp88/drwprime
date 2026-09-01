'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, IdCard, Printer, Trash2, X } from 'lucide-react';
import StaffIdCard from '@/components/treatment-ops/StaffIdCard';

type StaffRow = {
  id: string;
  employeeId: string;
  name: string;
  role: string;
  active: boolean;
  badgeIssuedAt: string | null;
  avatarUrl: string | null;
  branch: { name: string } | null;
};
type Issued = {
  staffId: string;
  employeeId: string;
  name: string;
  role: string;
  badgeValue: string;
  avatarUrl: string | null;
  branchName: string | null;
};

const roleLabel: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', FINANCE: 'Finance', MANAGEMENT: 'Manajemen', FRONT_OFFICE: 'Front Office',
  SUPERVISOR: 'Supervisor', THERAPIST: 'Terapis', DOCTOR: 'Dokter',
};

export default function BadgeManagementPage() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [busyId, setBusyId] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/treatment-ops/staff');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal memuat staf');
      setStaff(data.staff);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Gagal memuat data');
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const issue = async (staffId: string) => {
    setBusyId(staffId); setError('');
    try {
      const response = await fetch(`/api/treatment-ops/staff/${staffId}/badge`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menerbitkan kartu');
      const row = staff.find((member) => member.id === staffId);
      setIssued({
        staffId,
        employeeId: data.staff.employeeId,
        name: data.staff.name,
        role: data.staff.role,
        badgeValue: data.badgeValue,
        avatarUrl: row?.avatarUrl ?? null,
        branchName: row?.branch?.name ?? null,
      });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Gagal menerbitkan kartu');
    } finally { setBusyId(''); }
  };

  const viewBadge = async (staffId: string) => {
    setBusyId(staffId); setError('');
    try {
      const response = await fetch(`/api/treatment-ops/staff/${staffId}/badge`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Kartu tidak dapat dimuat');
      setIssued({
        staffId,
        employeeId: data.staff.employeeId,
        name: data.staff.name,
        role: data.staff.role,
        badgeValue: data.badgeValue,
        avatarUrl: data.avatarUrl,
        branchName: data.branchName,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Gagal memuat kartu');
    } finally { setBusyId(''); }
  };

  const removeBadge = async (member: StaffRow) => {
    const confirmed = window.confirm(`Hapus kartu ID ${member.name}? Barcode kartu tidak akan dapat digunakan lagi.`);
    if (!confirmed) return;
    const reason = window.prompt('Masukkan alasan penghapusan kartu:');
    if (reason === null) return;
    if (reason.trim().length < 2) { setError('Alasan penghapusan kartu wajib diisi.'); return; }
    setBusyId(member.id); setError('');
    try {
      const response = await fetch(`/api/treatment-ops/staff/${member.id}/badge`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Kartu tidak dapat dihapus');
      if (issued?.staffId === member.id) setIssued(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kartu tidak dapat dihapus');
    } finally { setBusyId(''); }
  };

  if (loading) return <div className="py-24 text-center text-sm text-white/50">Memuat daftar staf...</div>;
  return (
    <div>
      <section className="fo-glass-card rounded-[2rem] p-7 sm:p-9">
        <IdCard className="size-8 text-primary" />
        <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Identitas pribadi</p>
        <h1 className="font-playfair mt-2 text-4xl font-bold">Kartu ID Staf</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">Terbitkan kartu ID berisi barcode untuk tiap karyawan. Tim bisa mengunduh desain ID card dan mencetaknya sendiri. Scan barcode hanya oleh Super Admin.</p>
      </section>

      {error && <p className="mt-5 rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {staff.map((member) => (
          <article key={member.id} className="fo-glass-card-soft rounded-3xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold">{member.name}</h3>
                <p className="mt-1 text-[11px] text-white/45">{member.employeeId}</p>
              </div>
              <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-bold text-primary">{roleLabel[member.role] || member.role}</span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-[11px] text-white/50">
              <BadgeCheck className="size-4 text-primary/70" />
              {member.badgeIssuedAt ? `Kartu diterbitkan ${new Date(member.badgeIssuedAt).toLocaleDateString('id-ID')}` : 'Belum ada kartu'}
            </div>
            {member.badgeIssuedAt ? (
              <div className="mt-4 flex gap-2">
                <button disabled={busyId === member.id} onClick={() => void viewBadge(member.id)} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-xs font-bold text-black transition hover:bg-primary-light disabled:opacity-40"><IdCard className="size-4" /> {busyId === member.id ? 'Memuat...' : 'Lihat / Download ID Card'}</button>
                <button disabled={busyId === member.id} onClick={() => void removeBadge(member)} aria-label={`Hapus kartu ${member.name}`} className="flex size-11 items-center justify-center rounded-full border border-red-400/30 text-red-300 transition hover:bg-red-500 hover:text-white disabled:opacity-40"><Trash2 className="size-4" /></button>
              </div>
            ) : (
              <button
                disabled={busyId === member.id || !member.active}
                onClick={() => void issue(member.id)}
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full border border-primary/35 text-xs font-bold text-primary transition hover:bg-primary hover:text-black disabled:opacity-40"
              >
                <Printer className="size-4" /> {member.active ? (busyId === member.id ? 'Menerbitkan...' : 'Cetak / Terbitkan Kartu') : 'Nonaktif'}
              </button>
            )}
          </article>
        ))}
      </section>

      {issued && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="fo-glass-modal w-full max-w-md rounded-[2rem] p-6 sm:p-7 text-center">
            <div className="mb-4 flex items-start justify-between">
              <div className="text-left">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Kartu {issued.role === 'THERAPIST' ? 'Terapis' : roleLabel[issued.role] || issued.role}</p>
                <h2 className="font-playfair mt-1 text-xl font-bold">{issued.name}</h2>
              </div>
              <button onClick={() => setIssued(null)} className="rounded-full bg-white/10 p-2"><X className="size-5" /></button>
            </div>
            <StaffIdCard
              badgeValue={issued.badgeValue}
              name={issued.name}
              roleLabel={roleLabel[issued.role] || issued.role}
              employeeId={issued.employeeId}
              branchName={issued.branchName}
              avatarUrl={issued.avatarUrl}
            />
            <p className="mt-4 text-[11px] leading-5 text-white/45">Menerbitkan ulang akan membatalkan kartu sebelumnya. Jangan bagikan barcode di luar operasional.</p>
            <button onClick={() => void issue(issued.staffId)} className="mt-3 h-11 w-full rounded-full border border-primary/40 bg-primary/10 text-xs font-bold text-primary transition hover:bg-primary hover:text-black">Terbitkan Ulang Kartu</button>
          </div>
        </div>
      )}
    </div>
  );
}
