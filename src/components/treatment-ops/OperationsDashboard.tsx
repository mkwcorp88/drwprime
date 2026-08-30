'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, ClipboardCheck, Clock3, Phone, Play, Plus, QrCode, Sparkles, UserRound, UsersRound, WalletCards, X } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BadgeScannerModal from '@/components/treatment-ops/BadgeScannerModal';
import { roleLabels } from '@/lib/treatment-operations/constants';
import { formatPhone } from '@/lib/phone';
import type { OpsActionView, OpsBootstrap, OpsOrderView } from '@/types/treatment-operations';

const statusStyle: Record<string, string> = {
  CREATED: 'bg-sky-400/15 text-sky-300', ASSIGNED: 'bg-indigo-400/15 text-indigo-300',
  ON_PROCESS: 'bg-amber-400/15 text-amber-300', WAITING_NEXT_ACTION: 'bg-orange-400/15 text-orange-300',
  COMPLETED: 'bg-emerald-400/15 text-emerald-300', VERIFIED: 'bg-teal-400/15 text-teal-300', CANCELLED: 'bg-rose-400/15 text-rose-300',
};

const statusLabel: Record<string, string> = {
  CREATED: 'Dibuat', ASSIGNED: 'Ditugaskan', ON_PROCESS: 'Berjalan', WAITING_NEXT_ACTION: 'Menunggu',
  COMPLETED: 'Selesai', VERIFIED: 'Terverifikasi', CANCELLED: 'Dibatalkan',
};

const money = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

const roleLabel = (role: string) => (roleLabels as Record<string, string>)[role] ?? role;

const PERSONAL_ROLES = new Set(['THERAPIST', 'DOCTOR', 'APOTEKER', 'ASISTEN_APOTEKER', 'PERAWAT']);

const ROLE_COPY: Record<string, { eyebrow: string; title: string; description: string }> = {
  SUPER_ADMIN: {
    eyebrow: 'Workspace pusat',
    title: 'Jaga setiap alur treatment tetap rapi.',
    description: 'Pantau pasien, assignment, dan verifikasi tindakan dari satu workspace operasional.',
  },
  MANAGEMENT: {
    eyebrow: 'Ringkasan manajemen',
    title: 'Satu pandangan untuk seluruh ritme klinik.',
    description: 'Pantau order, performa tim, dan insentif tanpa kehilangan detail penting.',
  },
  FRONT_OFFICE: {
    eyebrow: 'Front office',
    title: 'Mulai kunjungan dengan lebih tenang.',
    description: 'Buat order, siapkan QR, dan bantu setiap pasien masuk ke alur treatment yang tepat.',
  },
  SUPERVISOR: {
    eyebrow: 'Supervisor',
    title: 'Pastikan tim bergerak sesuai alur.',
    description: 'Kelola order berjalan dan assignment eksekutor dari satu antrean yang jelas.',
  },
  THERAPIST: {
    eyebrow: 'Ruang kerja terapis',
    title: 'Fokus pada tindakan yang harus selesai.',
    description: 'Lihat tugas yang ditugaskan kepadamu, status tindakan, dan insentif yang sudah tercatat.',
  },
  DOCTOR: {
    eyebrow: 'Ruang kerja dokter',
    title: 'Konsultasi lebih terarah.',
    description: 'Pantau tindakan yang terkait denganmu dan tetap terhubung dengan alur pasien.',
  },
  APOTEKER: {
    eyebrow: 'Ruang kerja apoteker',
    title: 'Setiap detail perawatan tetap terjaga.',
    description: 'Lihat tugas yang ditugaskan kepadamu dan progres treatment secara ringkas.',
  },
  ASISTEN_APOTEKER: {
    eyebrow: 'Ruang kerja asisten apoteker',
    title: 'Kerjakan langkah berikutnya dengan jelas.',
    description: 'Semua tugas dan progres treatment yang relevan tersedia dalam satu tampilan.',
  },
  PERAWAT: {
    eyebrow: 'Ruang kerja perawat',
    title: 'Rawat alur pasien dari satu langkah ke langkah berikutnya.',
    description: 'Lihat tugas yang ditugaskan kepadamu dan status tindakan tanpa memenuhi layar.',
  },
};

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export default function OperationsDashboard() {
  const router = useRouter();
  const [bootstrap, setBootstrap] = useState<OpsBootstrap | null>(null);
  const [orders, setOrders] = useState<OpsOrderView[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [qr, setQr] = useState<{ orderNumber: string; url: string } | null>(null);
  const [scanTarget, setScanTarget] = useState<{ actionId: string; actionName: string; operation: 'start' | 'complete' } | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [busyAssign, setBusyAssign] = useState<string | null>(null);
  const [form, setForm] = useState({ branchId: '', patientId: '', doctorId: '', treatmentId: '', visitDate: new Date().toISOString().slice(0, 10), originalPrice: '', discountAmount: '0', internalNote: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [bootstrapResponse, ordersResponse] = await Promise.all([fetch('/api/treatment-ops/bootstrap'), fetch('/api/treatment-ops/orders')]);
      const boot = await bootstrapResponse.json();
      const orderData = await ordersResponse.json();
      if (bootstrapResponse.status === 401) { router.replace('/treatment-ops/login'); return; }
      if (boot.code === 'PASSWORD_CHANGE_REQUIRED') { router.replace('/treatment-ops/settings'); return; }
      if (!bootstrapResponse.ok) throw new Error(boot.error);
      if (!ordersResponse.ok) throw new Error(orderData.error);
      setBootstrap(boot);
      setOrders(orderData.orders);
      setForm((current) => ({ ...current, branchId: current.branchId || boot.staff.branchId || boot.branches[0]?.id || '' }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Gagal memuat data');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    let active = true;
    void Promise.all([fetch('/api/treatment-ops/bootstrap'), fetch('/api/treatment-ops/orders')]).then(async ([bootstrapResponse, ordersResponse]) => {
      const boot = await bootstrapResponse.json();
      const orderData = await ordersResponse.json();
      if (!active) return;
      if (bootstrapResponse.status === 401) { router.replace('/treatment-ops/login'); return; }
      if (boot.code === 'PASSWORD_CHANGE_REQUIRED') { router.replace('/treatment-ops/settings'); return; }
      if (!bootstrapResponse.ok) { setError(boot.error); setLoading(false); return; }
      if (!ordersResponse.ok) { setError(orderData.error); setLoading(false); return; }
      setBootstrap(boot);
      setOrders(orderData.orders);
      setForm((current) => ({ ...current, branchId: current.branchId || boot.staff.branchId || boot.branches[0]?.id || '' }));
      setLoading(false);
    });
    return () => { active = false; };
  }, [router]);

  const selectTreatment = (id: string) => {
    const treatment = bootstrap?.treatments.find((item) => item.id === id);
    setForm((current) => ({ ...current, treatmentId: id, originalPrice: treatment ? String(treatment.defaultPrice) : '' }));
  };

  const submitOrder = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    const response = await fetch('/api/treatment-ops/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || 'Gagal membuat order'); return; }
    const url = `${window.location.origin}/treatment-ops/scan/${data.qrToken}`;
    setQr({ orderNumber: data.order.orderNumber, url }); setShowForm(false); await load();
  };

  const openQr = async (order: OpsOrderView) => {
    const response = await fetch(`/api/treatment-ops/orders/${order.id}/qr`, { method: 'POST' });
    const data = await response.json();
    if (!response.ok) { setError(data.error || 'Gagal membuat QR'); return; }
    setQr({ orderNumber: order.orderNumber, url: `${window.location.origin}/treatment-ops/scan/${data.qrToken}` });
  };

  const assign = async (actionId: string, staffId: string) => {
    if (!staffId) return;
    const response = await fetch(`/api/treatment-ops/actions/${actionId}/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ therapistId: staffId }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || 'Gagal assign eksekutor'); else await load();
  };

  const assignAll = async (order: OpsOrderView, staffId: string) => {
    if (!staffId) return;
    const targets = order.actions.filter((action) => ['PENDING', 'ASSIGNED'].includes(action.status));
    setError(''); setBusyAssign(order.id);
    for (const action of targets) {
      const response = await fetch(`/api/treatment-ops/actions/${action.id}/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ therapistId: staffId }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error || 'Gagal assign eksekutor'); break; }
    }
    setBusyAssign(null);
    await load();
  };

  const staffForAction = (action: OpsActionView) =>
    bootstrap?.assignableStaff.filter((staff) => !action.requiredRoleSnapshot || staff.role === action.requiredRoleSnapshot) || [];

  const canCreate = Boolean(bootstrap && ['SUPER_ADMIN', 'FRONT_OFFICE', 'SUPERVISOR'].includes(bootstrap.staff.role));
  const canAssign = Boolean(bootstrap && ['SUPER_ADMIN', 'SUPERVISOR'].includes(bootstrap.staff.role));
  const canScan = bootstrap?.staff.role === 'SUPER_ADMIN';

  const isPersonalRole = Boolean(bootstrap && PERSONAL_ROLES.has(bootstrap.staff.role));
  const personalOrders = bootstrap
    ? orders.filter((order) => order.actions.some((action) => action.assignedTherapistId === bootstrap.staff.id || action.performedByTherapistId === bootstrap.staff.id))
    : [];
  const dashboardOrders = isPersonalRole ? personalOrders : orders;
  const personalActions = personalOrders.flatMap((order) => order.actions.filter((action) => action.assignedTherapistId === bootstrap?.staff.id || action.performedByTherapistId === bootstrap?.staff.id));
  const todayKey = new Date().toDateString();
  const todayPersonalActions = personalOrders.flatMap((order) => new Date(order.visitDate).toDateString() === todayKey
    ? order.actions.filter((action) => action.assignedTherapistId === bootstrap?.staff.id || action.performedByTherapistId === bootstrap?.staff.id)
    : []);
  const personalIncentive = personalActions
    .filter((action) => action.status === 'COMPLETED')
    .reduce((sum, action) => sum + Number(action.calculatedIncentive ?? 0), 0);
  const copy = ROLE_COPY[bootstrap?.staff.role || 'SUPER_ADMIN'] || ROLE_COPY.SUPER_ADMIN;
  const quickLinks = bootstrap ? [
    { href: '/treatment-ops/scan', label: bootstrap.staff.role === 'SUPER_ADMIN' ? 'Scan QR' : 'Barcode Saya', icon: QrCode },
    { href: '/treatment-ops/incentives', label: 'Insentif', icon: WalletCards },
    { href: '/treatment-ops/settings', label: 'Profil', icon: UserRound },
  ] : [];

  const performWithBadge = async (badgeToken: string) => {
    if (!scanTarget) return;
    const { actionId, operation } = scanTarget;
    setScanBusy(true); setError('');
    try {
      const response = await fetch(`/api/treatment-ops/actions/${actionId}/${operation}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ badgeToken }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || 'Gagal memproses tindakan'); return; }
      setScanTarget(null);
      await load();
    } catch {
      setError('Gagal memproses tindakan');
    } finally {
      setScanBusy(false);
    }
  };

  const completed = dashboardOrders.filter((order) => ['COMPLETED', 'VERIFIED'].includes(order.status)).length;
  const running = dashboardOrders.filter((order) => ['ON_PROCESS', 'WAITING_NEXT_ACTION'].includes(order.status)).length;

  if (loading) return <div className="py-24 text-center text-sm text-white/50">Menyiapkan operasional treatment...</div>;
  return (
    <div>
      {bootstrap && (
        <section className="mobile-surface fo-fade-up mb-5 flex flex-col gap-5 rounded-[2rem] p-5 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-4">
            {bootstrap.staff.avatarUrl ? (
              <img src={bootstrap.staff.avatarUrl} alt={bootstrap.staff.name} className="size-14 shrink-0 rounded-full object-cover ring-2 ring-primary/40" />
            ) : (
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-lg font-bold text-primary">
                {initials(bootstrap.staff.name)}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/70">Selamat datang kembali</p>
              <h2 className="font-playfair truncate text-xl font-bold">{bootstrap.staff.name}</h2>
              <p className="mt-0.5 text-xs text-white/50">
                {roleLabels[bootstrap.staff.role]} · {bootstrap.staff.employeeId}
                {bootstrap.staff.branch ? ` · ${bootstrap.staff.branch.name}` : ''}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-white/45">
                <Phone className="size-3.5 text-primary/70" />
                {bootstrap.staff.phone ? formatPhone(bootstrap.staff.phone) : 'Nomor WhatsApp belum diisi'}
              </p>
            </div>
          </div>
          {(!bootstrap.staff.phone || !bootstrap.staff.avatarUrl) && (
            <Link href="/treatment-ops/settings" className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-primary/35 px-5 text-xs font-bold text-primary transition hover:bg-primary hover:text-black">
              <UserRound className="size-4" /> Lengkapi profil
            </Link>
          )}
        </section>
      )}

       <section className="mobile-surface fo-glass-card fo-fade-up relative overflow-hidden rounded-[2rem] p-5 sm:p-9">
        <div className="absolute -right-16 -top-20 size-64 rounded-full border border-primary/15" />
        <div className="absolute -bottom-28 right-24 size-52 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
             <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-primary"><Sparkles className="size-4" /> {copy.eyebrow}</p>
             <h1 className="mobile-page-title font-playfair max-w-2xl text-[2rem] font-bold leading-[1.08] sm:text-5xl">{copy.title}</h1>
             <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">{copy.description}</p>
           </div>
           {canCreate && <button onClick={() => setShowForm(true)} className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-black shadow-[0_0_28px_rgba(212,175,55,0.35)] transition hover:bg-primary-light"><Plus className="size-4" /> Buat Order</button>}
         </div>
         <div className="mt-6 grid grid-cols-3 gap-2 md:hidden">
           {quickLinks.map(({ href, label, icon: Icon }) => (
             <Link key={href} href={href} className="mobile-surface-soft flex min-h-[4.7rem] flex-col items-center justify-center gap-2 rounded-2xl px-2 text-center text-[10px] font-semibold text-white/75 transition active:scale-[0.98]">
               <Icon className="size-5 text-primary" />
               <span className="leading-tight">{label}</span>
             </Link>
           ))}
         </div>
       </section>

      {error && <div className="mt-5 flex items-center justify-between rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200"><span>{error}</span><button onClick={() => setError('')}><X className="size-4" /></button></div>}

       <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
         {(isPersonalRole
           ? [
               { label: 'Tugas saya', value: personalActions.length, icon: ClipboardCheck },
               { label: 'Jadwal hari ini', value: todayPersonalActions.length, icon: CalendarDays },
               { label: 'Selesai', value: personalActions.filter((action) => action.status === 'COMPLETED').length, icon: CheckCircle2 },
               { label: 'Insentif tercatat', value: money(personalIncentive), icon: WalletCards },
             ]
           : [
               { label: 'Order hari ini', value: dashboardOrders.length, icon: CalendarDays },
               { label: 'Sedang berjalan', value: running, icon: Clock3 },
               { label: 'Selesai', value: completed, icon: CheckCircle2 },
               { label: 'Eksekutor aktif', value: bootstrap?.assignableStaff.length || 0, icon: UsersRound },
             ]
         ).map(({ label, value, icon: Icon }) => (
           <div key={label} className="mobile-surface-soft fo-fade-up fo-stagger-1 rounded-3xl p-4 sm:p-5"><Icon className="mb-5 size-5 text-primary" /><p className={`${typeof value === 'string' ? 'text-lg sm:text-2xl' : 'text-3xl'} font-bold`}>{value}</p><p className="mt-1 text-xs text-white/50">{label}</p></div>
         ))}
       </section>

       <section className="mt-8 fo-fade-up fo-stagger-2">
         <div className="mb-4 flex items-end justify-between gap-4">
           <div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">{isPersonalRole ? 'Tugas yang ditugaskan' : 'Antrean operasional'}</p><h2 className="mobile-page-title font-playfair mt-1 text-2xl font-bold">{isPersonalRole ? 'Tugas saya' : 'Order treatment'}</h2></div>
           <span className="text-xs text-white/40">{bootstrap?.staff.name} · {bootstrap?.staff.role.replaceAll('_', ' ')}</span>
         </div>
         {dashboardOrders.length === 0 ? <div className="rounded-3xl border border-dashed border-white/20 bg-white/[0.02] px-6 py-16 text-center text-sm text-white/40">{isPersonalRole ? 'Belum ada tugas yang ditugaskan kepadamu.' : 'Belum ada order. Buat order pertama untuk memulai.'}</div> : <div className="space-y-4">{dashboardOrders.map((order) => {
          const done = order.actions.filter((action) => action.status === 'COMPLETED').length;
          const progress = order.actions.length ? Math.round(done / order.actions.length * 100) : 0;
          return (
            <article key={order.id} className="mobile-surface-soft overflow-hidden rounded-3xl">
              <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{order.orderNumber}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusStyle[order.status] || 'bg-white/10 text-white/60'}`}>{statusLabel[order.status] || order.status}</span></div>
                  <p className="mt-2 text-lg font-semibold">{order.patientNameSnapshot} <span className="font-normal text-white/30">·</span> {order.treatmentNameSnapshot}</p>
                  <p className="mt-1 text-xs text-white/45">{new Date(order.visitDate).toLocaleDateString('id-ID')} · {order.doctor?.name || 'Tanpa dokter'} · {money(order.finalPrice)}</p>
                </div>
                <button onClick={() => void openQr(order)} className="flex h-11 items-center justify-center gap-2 rounded-full border border-primary/30 px-5 text-xs font-bold text-primary transition hover:bg-primary hover:text-black"><QrCode className="size-4" /> Tampilkan QR</button>
              </div>
              <div className="p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div>
                  <span className="text-xs font-bold text-primary">{done}/{order.actions.length}</span>
                </div>
                {canAssign && (
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/45">Assign semua ke</span>
                    <select value="" onChange={(event) => event.target.value && void assignAll(order, event.target.value)} className="rounded-xl border border-white/15 bg-black/40 px-2 py-1.5 text-[10px] text-white outline-none focus:border-primary/60">
                      <option value="">Pilih eksekutor</option>
                      {bootstrap?.assignableStaff.map((staff) => <option key={staff.id} value={staff.id}>{staff.name} · {roleLabel(staff.role)}</option>)}
                    </select>
                    {busyAssign === order.id && <span className="text-[10px] text-white/45">Meng-assign...</span>}
                  </div>
                )}
                <div className="grid gap-2 lg:grid-cols-2">
                  {order.actions.map((action) => {
                    const canStartScan = canScan && ['PENDING', 'ASSIGNED'].includes(action.status);
                    const canCompleteScan = canScan && action.status === 'ON_PROCESS';
                    return (
                      <div key={action.id} className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
                        <div className="flex items-center gap-3">
                          <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${action.status === 'COMPLETED' ? 'bg-emerald-500 text-black' : action.status === 'ON_PROCESS' ? 'bg-primary text-black' : 'bg-white/10 text-white/50'}`}>{action.sequenceNumber}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{action.actionNameSnapshot}</p>
                            <p className="text-[10px] text-white/45">{action.performedTherapist?.name || action.assignedTherapist?.name || (action.isRequired ? 'Wajib · belum ditugaskan' : 'Opsional')}</p>
                          </div>
                          <span className="text-[10px] font-bold text-primary">{money(action.calculatedIncentive ?? action.incentiveValueSnapshot)}</span>
                        </div>
                        {(canAssign || canStartScan || canCompleteScan) && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {canAssign && ['PENDING', 'ASSIGNED'].includes(action.status) && (
                              <select value={action.assignedTherapistId || ''} onChange={(event) => void assign(action.id, event.target.value)} className="max-w-40 rounded-xl border border-white/15 bg-black/40 px-2 py-2 text-[10px] text-white outline-none focus:border-primary/60"><option value="">Assign eksekutor</option>{staffForAction(action).map((staff) => <option key={staff.id} value={staff.id}>{staff.name}{action.requiredRoleSnapshot ? '' : ` · ${roleLabel(staff.role)}`}</option>)}</select>
                            )}
                            {canStartScan && (
                              <button onClick={() => setScanTarget({ actionId: action.id, actionName: action.actionNameSnapshot, operation: 'start' })} className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-[10px] font-bold text-black transition hover:bg-primary-light"><Play className="size-3.5" /> Mulai</button>
                            )}
                            {canCompleteScan && (
                              <button onClick={() => setScanTarget({ actionId: action.id, actionName: action.actionNameSnapshot, operation: 'complete' })} className="flex h-9 items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 text-[10px] font-bold text-primary transition hover:bg-primary hover:text-black"><Clock3 className="size-3.5" /> Selesai</button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </article>
          );
        })}</div>}
      </section>

      {showForm && bootstrap && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <form onSubmit={submitOrder} className="fo-glass-modal max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] p-6 sm:rounded-[2rem] sm:p-8">
            <div className="mb-6 flex items-start justify-between">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Front Office</p><h2 className="font-playfair mt-1 text-2xl font-bold">Order treatment baru</h2></div>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-full bg-white/10 p-2"><X className="size-5" /></button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cabang"><select required value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>{bootstrap.branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
              <Field label="Tanggal kunjungan"><input required type="date" value={form.visitDate} onChange={(e) => setForm({ ...form, visitDate: e.target.value })} /></Field>
              <Field label="Pasien"><select required value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })}><option value="">Pilih pasien</option>{bootstrap.patients.filter((item) => item.branchId === form.branchId).map((item) => <option key={item.id} value={item.id}>{item.patientNumber} · {item.name}</option>)}</select></Field>
              <Field label="Dokter"><select value={form.doctorId} onChange={(e) => setForm({ ...form, doctorId: e.target.value })}><option value="">Tanpa dokter</option>{bootstrap.doctors.filter((item) => item.branchId === form.branchId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
              <Field label="Treatment"><select required value={form.treatmentId} onChange={(e) => selectTreatment(e.target.value)}><option value="">Pilih treatment</option>{bootstrap.treatments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
              <Field label="Harga aktual"><input required inputMode="numeric" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: e.target.value })} /></Field>
              <Field label="Diskon"><input inputMode="numeric" value={form.discountAmount} onChange={(e) => setForm({ ...form, discountAmount: e.target.value })} /></Field>
              <Field label="Catatan internal"><input value={form.internalNote} onChange={(e) => setForm({ ...form, internalNote: e.target.value })} placeholder="Opsional" /></Field>
            </div>
            <button className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-black transition hover:bg-primary-light"><Plus className="size-4" /> Buat order & QR</button>
          </form>
        </div>
      )}

      {qr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="fo-glass-modal w-full max-w-sm rounded-[2rem] p-7 text-center">
            <div className="mb-5 flex items-center justify-between"><span className="text-xs font-bold text-primary">{qr.orderNumber}</span><button onClick={() => setQr(null)}><X className="size-5" /></button></div>
            <div className="mx-auto w-fit rounded-3xl bg-white p-4"><QRCodeCanvas value={qr.url} size={220} level="H" /></div>
            <h3 className="font-playfair mt-5 text-xl font-bold">QR Order Treatment</h3>
            <p className="mt-2 text-xs leading-5 text-white/50">Tampilkan QR ini kepada terapis. Jangan membagikannya di luar operasional klinik.</p>
          </div>
        </div>
      )}

      {scanTarget && (
        <BadgeScannerModal
          title={scanTarget.operation === 'start' ? 'Mulai Tindakan' : 'Selesaikan Tindakan'}
          subtitle={scanTarget.actionName}
          busy={scanBusy}
          onToken={(token) => void performWithBadge(token)}
          onClose={() => { if (!scanBusy) setScanTarget(null); }}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-bold text-white/60">{label}<div className="mt-1.5 [&>*]:h-11 [&>*]:w-full [&>*]:rounded-xl [&>*]:bg-black/30 [&>*]:px-3 [&>*]:text-sm [&>*]:text-white [&>*]:ring-1 [&>*]:ring-white/20 [&>*]:outline-none focus-within:[&>*]:ring-primary/60 [&>select>option]:bg-[#0a0a0a]">{children}</div></label>;
}
