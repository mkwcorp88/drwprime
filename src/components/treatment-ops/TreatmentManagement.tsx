'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FlaskConical, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { OpsTreatmentView } from '@/types/treatment-operations';

type ActionRow = {
  actionName: string;
  sequenceNumber: number;
  isRequired: boolean;
  requiredRole: string;
  estimatedDurationMinutes: string;
  incentiveType: string;
  incentiveValue: string;
};

type TreatmentForm = {
  id: string | null;
  code: string;
  name: string;
  category: string;
  defaultPrice: string;
  active: boolean;
  reason: string;
  actions: ActionRow[];
};

const emptyAction = (sequence: number): ActionRow => ({
  actionName: '', sequenceNumber: sequence, isRequired: true, requiredRole: '',
  estimatedDurationMinutes: '', incentiveType: 'FIXED', incentiveValue: '0',
});

const emptyForm: TreatmentForm = {
  id: null, code: '', name: '', category: '', defaultPrice: '0', active: true, reason: '',
  actions: [emptyAction(1)],
};

const roleLabels: Record<string, string> = { '': 'Semua eksekutor', THERAPIST: 'Terapis', DOCTOR: 'Dokter', PERAWAT: 'Perawat' };
const incentiveLabels: Record<string, string> = { FIXED: 'Nominal', PERCENTAGE: 'Persen', POINTS: 'Poin', NONE: 'Tanpa insentif' };

export default function TreatmentManagement() {
  const router = useRouter();
  const [treatments, setTreatments] = useState<OpsTreatmentView[]>([]);
  const [form, setForm] = useState<TreatmentForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const response = await fetch('/api/treatment-ops/treatments', { cache: 'no-store' });
    const data = await response.json();
    if (response.status === 401) { router.replace('/treatment-ops/login'); return; }
    if (!response.ok) { setError(data.error || 'Gagal memuat treatment.'); return; }
    setTreatments(data.treatments);
  };

  useEffect(() => {
    let active = true;
    void fetch('/api/treatment-ops/treatments', { cache: 'no-store' })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!active) return;
        if (response.status === 401) { router.replace('/treatment-ops/login'); return; }
        if (!response.ok) { setError(data.error || 'Gagal memuat treatment.'); return; }
        setTreatments(data.treatments);
      })
      .catch(() => { if (active) setError('Gagal memuat treatment.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [router]);

  const openCreate = () => {
    setError(''); setNotice('');
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (treatment: OpsTreatmentView) => {
    setError(''); setNotice('');
    setForm({
      id: treatment.id,
      code: treatment.code,
      name: treatment.name,
      category: treatment.category ?? '',
      defaultPrice: String(treatment.defaultPrice),
      active: treatment.active,
      reason: '',
      actions: treatment.actionTemplates.map((action) => ({
        actionName: action.actionName,
        sequenceNumber: action.sequenceNumber,
        isRequired: action.isRequired,
        requiredRole: action.requiredRole ?? '',
        estimatedDurationMinutes: action.estimatedDurationMinutes != null ? String(action.estimatedDurationMinutes) : '',
        incentiveType: action.incentiveType,
        incentiveValue: String(action.incentiveValue),
      })),
    });
    setShowForm(true);
  };

  const setAction = (index: number, patch: Partial<ActionRow>) => {
    setForm((current) => ({
      ...current,
      actions: current.actions.map((action, i) => (i === index ? { ...action, ...patch } : action)),
    }));
  };

  const addAction = () => {
    setForm((current) => ({
      ...current,
      actions: [...current.actions, emptyAction(current.actions.length + 1)],
    }));
  };

  const removeAction = (index: number) => {
    setForm((current) => {
      const actions = current.actions.filter((_, i) => i !== index);
      return { ...current, actions: actions.map((action, i) => ({ ...action, sequenceNumber: i + 1 })) };
    });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(''); setNotice('');
    if (form.active && Number(form.defaultPrice || 0) <= 0) {
      setError('Treatment aktif wajib memiliki harga default lebih dari 0. Isi harga dahulu.');
      return;
    }
    if (form.reason.trim().length < 2) {
      setError('Alasan perubahan wajib diisi.');
      return;
    }
    setBusy(true);
    const body = {
      code: form.code,
      name: form.name,
      category: form.category || null,
      defaultPrice: Number(form.defaultPrice || 0),
      active: form.active,
      reason: form.reason.trim(),
      actions: form.actions.map((action) => ({
        actionName: action.actionName,
        sequenceNumber: action.sequenceNumber,
        isRequired: action.isRequired,
        requiredRole: action.requiredRole || null,
        estimatedDurationMinutes: action.estimatedDurationMinutes ? Number(action.estimatedDurationMinutes) : null,
        incentiveType: action.incentiveType,
        incentiveValue: Number(action.incentiveValue || 0),
      })),
    };
    const response = await fetch(form.id ? `/api/treatment-ops/treatments/${form.id}` : '/api/treatment-ops/treatments', {
      method: form.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      if (response.status === 401) router.replace('/treatment-ops/login');
      setError(data.error || 'Treatment tidak dapat disimpan.');
      return;
    }
    setNotice(form.id ? 'Treatment berhasil diperbarui.' : 'Treatment berhasil dibuat.');
    setShowForm(false);
    await load();
  };

  return (
    <div>
      <section className="fo-glass-card rounded-[2rem] p-7 sm:p-9">
        <FlaskConical className="size-8 text-primary" />
        <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Super Admin</p>
        <h1 className="font-playfair mt-2 text-4xl font-bold">Master Treatment</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">Kelola treatment beserta tahapan tindakan, role eksekutor, dan insentifnya. Tahapan otomatis dibuat saat order dibuat.</p>
        <button onClick={openCreate} className="mt-6 flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-xs font-bold text-black transition hover:bg-primary-light"><Plus className="size-4" /> Buat Treatment</button>
      </section>

      {error && <p className="mt-5 flex items-center justify-between rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200"><span>{error}</span><button onClick={() => setError('')}><X className="size-4" /></button></p>}
      {notice && <p className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">{notice}</p>}

      <section className="mt-6 grid gap-3 lg:grid-cols-2">
        {loading ? <p className="py-12 text-sm text-white/45">Memuat treatment...</p> : treatments.map((treatment) => (
          <article key={treatment.id} className="fo-glass-card-soft rounded-3xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold">{treatment.name}</h3>
                  <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-bold text-primary">{treatment.code}</span>
                  {!treatment.active && <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/50">Nonaktif</span>}
                  {Number(treatment.defaultPrice) <= 0 && <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-[10px] font-bold text-amber-300">Harga belum diisi</span>}
                </div>
                <p className="mt-1 text-xs text-white/45">{treatment.category || 'Tanpa kategori'} · {treatment.actionTemplates.length} tahapan</p>
              </div>
              <button onClick={() => openEdit(treatment)} className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-primary/35 px-4 text-xs font-bold text-primary transition hover:bg-primary hover:text-black"><Pencil className="size-3.5" /> Edit</button>
            </div>
            <div className="mt-4 space-y-1.5">
              {treatment.actionTemplates.map((action) => (
                <div key={action.id} className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-xs">
                  <span className="text-white/75"><strong className="text-white/90">{action.sequenceNumber}.</strong> {action.actionName}</span>
                  <span className="text-[10px] text-white/45">{roleLabels[action.requiredRole ?? ''] || action.requiredRole} · {incentiveLabels[action.incentiveType] || action.incentiveType} {Number(action.incentiveValue) > 0 ? action.incentiveValue : ''}</span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <form onSubmit={save} className="fo-glass-modal max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-[2rem] p-6 sm:rounded-[2rem] sm:p-8">
            <div className="mb-6 flex items-start justify-between">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Master Treatment</p><h2 className="font-playfair mt-1 text-2xl font-bold">{form.id ? 'Edit treatment' : 'Buat treatment'}</h2></div>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-full bg-white/10 p-2"><X className="size-5" /></button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Kode"><input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="FAC-BRIGHT" /></Field>
              <Field label="Nama"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Kategori"><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
              <Field label="Harga default (Rp)"><input required inputMode="numeric" value={form.defaultPrice} onChange={(e) => setForm({ ...form, defaultPrice: e.target.value })} /></Field>
              <label className="flex items-center gap-3 text-xs font-bold text-white/55 sm:col-span-2">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="size-4 accent-[#D4AF37]" />
                Treatment aktif (muncul saat buat order)
              </label>
              <div className="sm:col-span-2">
                <Field label="Alasan perubahan"><input required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Mis. update fee master atau lengkapi harga jual" /></Field>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Tahapan tindakan</p>
              <button type="button" onClick={addAction} className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-[11px] font-bold text-black transition hover:bg-primary-light"><Plus className="size-3.5" /> Tambah tahap</button>
            </div>
            <div className="mt-3 space-y-2">
              {form.actions.map((action, index) => (
                <div key={index} className="grid gap-2 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10 sm:grid-cols-12">
                  <div className="sm:col-span-3"><input value={action.actionName} onChange={(e) => setAction(index, { actionName: e.target.value })} placeholder={`Tindakan ${action.sequenceNumber}`} className="h-10 w-full rounded-lg bg-black/30 px-3 text-sm outline-none ring-1 ring-white/15 focus:ring-primary/60" /></div>
                  <div className="sm:col-span-2"><select value={action.requiredRole} onChange={(e) => setAction(index, { requiredRole: e.target.value })} className="h-10 w-full rounded-lg bg-black px-2 text-xs outline-none ring-1 ring-white/15">{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                  <div className="sm:col-span-2"><select value={action.incentiveType} onChange={(e) => setAction(index, { incentiveType: e.target.value })} className="h-10 w-full rounded-lg bg-black px-2 text-xs outline-none ring-1 ring-white/15">{Object.entries(incentiveLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                  <div className="sm:col-span-2"><input value={action.incentiveValue} onChange={(e) => setAction(index, { incentiveValue: e.target.value })} inputMode="numeric" placeholder="Nilai" className="h-10 w-full rounded-lg bg-black/30 px-3 text-xs outline-none ring-1 ring-white/15 focus:ring-primary/60" /></div>
                  <div className="sm:col-span-1"><input value={action.estimatedDurationMinutes} onChange={(e) => setAction(index, { estimatedDurationMinutes: e.target.value })} inputMode="numeric" placeholder="Menit" className="h-10 w-full rounded-lg bg-black/30 px-2 text-xs outline-none ring-1 ring-white/15 focus:ring-primary/60" /></div>
                  <div className="flex items-center justify-between gap-2 sm:col-span-2">
                    <label className="flex items-center gap-1.5 text-[10px] font-bold text-white/55"><input type="checkbox" checked={action.isRequired} onChange={(e) => setAction(index, { isRequired: e.target.checked })} className="size-3.5 accent-[#D4AF37]" /> Wajib</label>
                    {form.actions.length > 1 && <button type="button" onClick={() => removeAction(index)} className="rounded-full bg-white/10 p-1.5 text-white/60 hover:text-red-300"><Trash2 className="size-3.5" /></button>}
                  </div>
                </div>
              ))}
            </div>

            <button disabled={busy} className="mt-6 h-12 w-full rounded-full bg-primary text-sm font-bold text-black transition hover:bg-primary-light disabled:opacity-50">{busy ? 'Menyimpan...' : 'Simpan Treatment'}</button>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-bold text-white/55">{label}<span className="mt-2 block [&_input]:h-12 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-white/15 [&_input]:bg-black/30 [&_input]:px-4 [&_input]:text-sm [&_input]:text-white [&_input]:outline-none">{children}</span></label>;
}
