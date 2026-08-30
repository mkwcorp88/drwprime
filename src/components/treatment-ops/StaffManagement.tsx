'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Plus, UserCog, X } from 'lucide-react';

type Branch = { id: string; name: string };
type StaffRow = {
  id: string;
  branchId: string | null;
  employeeId: string;
  name: string;
  email: string | null;
  role: string;
  active: boolean;
  mustChangePassword: boolean;
  passwordChangedAt: string | null;
  lastLoginAt: string | null;
  branch: { name: string } | null;
};

const roles = [
  ['MANAGEMENT', 'Manajemen'],
  ['FRONT_OFFICE', 'Front Office'],
  ['SUPERVISOR', 'Supervisor'],
  ['THERAPIST', 'Terapis'],
  ['DOCTOR', 'Dokter'],
  ['PERAWAT', 'Perawat'],
  ['APOTEKER', 'Apoteker'],
  ['ASISTEN_APOTEKER', 'Asisten Apoteker'],
  ['SUPER_ADMIN', 'Super Admin'],
] as const;

const roleLabel = Object.fromEntries(roles);
const emptyForm = { employeeId: '', name: '', email: '', role: 'THERAPIST', branchId: '', password: '', confirmation: '' };

export default function StaffManagement() {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [resetTarget, setResetTarget] = useState<StaffRow | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const response = await fetch('/api/treatment-ops/staff', { cache: 'no-store' });
    const data = await response.json();
    if (response.status === 401) { router.replace('/treatment-ops/login'); return; }
    if (!response.ok) { setError(data.error || 'Gagal memuat akun staf.'); return; }
    setStaff(data.staff);
    setBranches(data.branches);
    setForm((current) => ({ ...current, branchId: current.branchId || data.branches[0]?.id || '' }));
  };

  useEffect(() => {
    let active = true;
    void fetch('/api/treatment-ops/staff', { cache: 'no-store' })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!active) return;
        if (response.status === 401) { router.replace('/treatment-ops/login'); return; }
        if (!response.ok) { setError(data.error || 'Gagal memuat akun staf.'); return; }
        setStaff(data.staff);
        setBranches(data.branches);
        setForm((current) => ({ ...current, branchId: current.branchId || data.branches[0]?.id || '' }));
      })
      .catch(() => { if (active) setError('Gagal memuat akun staf.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [router]);

  const createStaff = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(''); setNotice('');
    if (form.password !== form.confirmation) { setError('Konfirmasi password awal tidak sama.'); return; }
    setBusy(true);
    const response = await fetch('/api/treatment-ops/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) { setError(data.error || 'Akun staf tidak dapat dibuat.'); return; }
    setNotice(`Akun ${data.staff.name} berhasil dibuat. Berikan email dan password awal secara pribadi.`);
    setForm({ ...emptyForm, branchId: branches[0]?.id || '' });
    await load();
  };

  const reset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resetTarget) return;
    setError(''); setNotice('');
    if (resetPassword !== resetConfirmation) { setError('Konfirmasi password awal tidak sama.'); return; }
    setBusy(true);
    const response = await fetch(`/api/treatment-ops/staff/${resetTarget.id}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: resetPassword }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) { setError(data.error || 'Password tidak dapat direset.'); return; }
    setNotice(`Password ${resetTarget.name} berhasil direset. Semua sesi lama telah dikeluarkan.`);
    setResetTarget(null); setResetPassword(''); setResetConfirmation('');
    await load();
  };

  return (
    <div>
      <section className="fo-glass-card rounded-[2rem] p-7 sm:p-9">
        <UserCog className="size-8 text-primary" />
        <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Super Admin</p>
        <h1 className="font-playfair mt-2 text-4xl font-bold">Akun Staf</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">Buat akun pribadi dengan password awal. Staf wajib membuat password baru saat login pertama.</p>
      </section>

      {error && <p className="mt-5 flex items-center justify-between rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200"><span>{error}</span><button onClick={() => setError('')}><X className="size-4" /></button></p>}
      {notice && <p className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">{notice}</p>}

      <section className="fo-glass-card-soft mt-6 rounded-3xl p-5 sm:p-7">
        <div className="mb-5 flex items-center gap-3"><Plus className="size-5 text-primary" /><h2 className="font-playfair text-xl font-bold">Buat akun baru</h2></div>
        <form onSubmit={createStaff} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="ID karyawan"><input required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} placeholder="TRP-003" /></Field>
          <Field label="Nama lengkap"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email login"><input required type="email" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nama@drwprime.com" /></Field>
          <Field label="Role"><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="Cabang"><select required={form.role !== 'SUPER_ADMIN'} value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}><option value="">Tanpa cabang</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></Field>
          <div className="hidden lg:block" />
          <Field label="Password awal"><input required type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          <Field label="Konfirmasi password"><input required type="password" autoComplete="new-password" value={form.confirmation} onChange={(e) => setForm({ ...form, confirmation: e.target.value })} /></Field>
          <div className="flex items-end"><button disabled={busy} className="h-12 w-full rounded-full bg-primary text-sm font-bold text-black transition hover:bg-primary-light disabled:opacity-50">{busy ? 'Menyimpan...' : 'Buat Akun Staf'}</button></div>
        </form>
        <p className="mt-4 text-[11px] text-white/35">Password minimal 10 karakter dan harus memiliki huruf besar, huruf kecil, angka, serta simbol.</p>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? <p className="py-12 text-sm text-white/45">Memuat staf...</p> : staff.map((member) => (
          <article key={member.id} className="fo-glass-card-soft rounded-3xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><h3 className="truncate font-bold">{member.name}</h3><p className="mt-1 truncate text-[11px] text-white/45">{member.email || 'Email belum diatur'}</p></div>
              <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-bold text-primary">{roleLabel[member.role] || member.role}</span>
            </div>
            <p className="mt-4 text-xs text-white/45">{member.employeeId} · {member.branch?.name || 'Semua cabang'}</p>
            <p className={`mt-2 text-[11px] font-semibold ${member.mustChangePassword ? 'text-amber-300' : 'text-emerald-300'}`}>{member.mustChangePassword ? 'Menunggu ganti password awal' : 'Password pribadi aktif'}</p>
            <button onClick={() => { setResetTarget(member); setError(''); }} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-full border border-primary/35 text-xs font-bold text-primary transition hover:bg-primary hover:text-black"><KeyRound className="size-3.5" /> Reset Password</button>
          </article>
        ))}
      </section>

      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <form onSubmit={reset} className="fo-glass-modal w-full max-w-md rounded-[2rem] p-7">
            <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Reset password</p><h2 className="font-playfair mt-1 text-2xl font-bold">{resetTarget.name}</h2></div><button type="button" onClick={() => setResetTarget(null)}><X className="size-5" /></button></div>
            <p className="mt-3 text-xs leading-5 text-white/45">Semua sesi staf akan dikeluarkan. Password baru ini wajib diganti saat login berikutnya.</p>
            <div className="mt-6 space-y-4">
              <Field label="Password awal baru"><input required type="password" autoComplete="new-password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} /></Field>
              <Field label="Konfirmasi password"><input required type="password" autoComplete="new-password" value={resetConfirmation} onChange={(e) => setResetConfirmation(e.target.value)} /></Field>
            </div>
            <button disabled={busy} className="mt-6 h-12 w-full rounded-full bg-primary text-sm font-bold text-black disabled:opacity-50">{busy ? 'Mereset...' : 'Reset Password'}</button>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-bold text-white/55">{label}<span className="mt-2 block [&_input]:h-12 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-white/15 [&_input]:bg-black/30 [&_input]:px-4 [&_input]:text-sm [&_input]:text-white [&_input]:outline-none [&_select]:h-12 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-white/15 [&_select]:bg-black [&_select]:px-4 [&_select]:text-sm [&_select]:text-white [&_select]:outline-none">{children}</span></label>;
}
