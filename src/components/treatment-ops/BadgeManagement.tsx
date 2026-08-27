'use client';

import { useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { BadgeCheck, IdCard, Printer, X } from 'lucide-react';

type StaffRow = { id: string; employeeId: string; name: string; role: string; active: boolean; badgeIssuedAt: string | null };
type Issued = { staff: { employeeId: string; name: string; role: string }; badgeValue: string };

const roleLabel: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', MANAGEMENT: 'Manajemen', FRONT_OFFICE: 'Front Office',
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
      setIssued(data);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Gagal menerbitkan kartu');
    } finally { setBusyId(''); }
  };

  if (loading) return <div className="py-24 text-center text-sm text-white/50">Memuat daftar staf...</div>;
  return (
    <div>
      <section className="fo-glass-card rounded-[2rem] p-7 sm:p-9">
        <IdCard className="size-8 text-primary" />
        <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Identitas pribadi</p>
        <h1 className="font-playfair mt-2 text-4xl font-bold">Kartu QR Staf</h1>
        <p className="mt-2 max-w-xl text-sm text-white/50">Setiap terapis dan petugas memiliki kartu QR pribadi. Scan kartu di dashboard untuk mencatat siapa yang menjalankan tindakan.</p>
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
            <button
              disabled={busyId === member.id || !member.active}
              onClick={() => void issue(member.id)}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-xs font-bold text-black transition hover:bg-primary-light disabled:opacity-40"
            >
              <Printer className="size-4" /> {member.active ? (busyId === member.id ? 'Menerbitkan...' : 'Cetak / Terbitkan Kartu') : 'Nonaktif'}
            </button>
          </article>
        ))}
      </section>

      {issued && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="fo-glass-modal w-full max-w-sm rounded-[2rem] p-7 text-center">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-xs font-bold text-primary">Kartu {issued.staff.role === 'THERAPIST' ? 'Terapis' : roleLabel[issued.staff.role]}</span>
              <button onClick={() => setIssued(null)}><X className="size-5" /></button>
            </div>
            <div className="mx-auto w-fit rounded-3xl bg-white p-4"><QRCodeCanvas value={issued.badgeValue} size={230} level="H" /></div>
            <h3 className="font-playfair mt-5 text-xl font-bold">{issued.staff.name}</h3>
            <p className="mt-1 text-xs text-white/50">{issued.staff.employeeId}</p>
            <p className="mt-4 text-[11px] leading-5 text-white/45">Kartu berisi token acak saja. Menerbitkan ulang akan membatalkan kartu sebelumnya. Jangan bagikan QR di luar operasional.</p>
          </div>
        </div>
      )}
    </div>
  );
}
