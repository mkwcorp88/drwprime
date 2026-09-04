'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronDown, ClipboardCheck, Clock3, Phone, Play, Plus, QrCode, Search, Sparkles, Trash2, UserRound, UsersRound, WalletCards, X } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AidoPatientPicker from '@/components/treatment-ops/AidoPatientPicker';
import BadgeScannerModal from '@/components/treatment-ops/BadgeScannerModal';
import { ORDER_MANAGEMENT_ROLES, roleLabels } from '@/lib/treatment-operations/constants';
import { dateKeyFromDate } from '@/lib/treatment-operations/date';
import { formatPhone } from '@/lib/phone';
import type { OpsActionView, OpsBootstrap, OpsOrderView, OpsStaffDayOffSummary } from '@/types/treatment-operations';

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
const schedule = (order: OpsOrderView) => order.scheduledAt
  ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(order.scheduledAt))
  : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' }).format(new Date(order.visitDate));

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
  const [staffDayOffs, setStaffDayOffs] = useState<OpsStaffDayOffSummary[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [qr, setQr] = useState<Array<{ orderNumber: string; url: string }> | null>(null);
  const [scanTarget, setScanTarget] = useState<{ actionId: string; actionName: string; operation: 'start' | 'complete' } | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [busyAssign, setBusyAssign] = useState<string | null>(null);
  const [form, setForm] = useState({ branchId: '', patientId: '', doctorId: '', visitDate: dateKeyFromDate(new Date()), visitTime: '', treatments: [{ treatmentId: '', originalPrice: '', discountAmount: '0' }], internalNote: '' });

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
       setStaffDayOffs(orderData.staffDayOffs || []);
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
       setStaffDayOffs(orderData.staffDayOffs || []);
       setForm((current) => ({ ...current, branchId: current.branchId || boot.staff.branchId || boot.branches[0]?.id || '' }));
      setLoading(false);
    });
    return () => { active = false; };
  }, [router]);

  const selectTreatment = (index: number, id: string) => {
    const treatment = bootstrap?.treatments.find((item) => item.id === id);
    setForm((current) => ({ ...current, treatments: current.treatments.map((item, itemIndex) => itemIndex === index ? { ...item, treatmentId: id, originalPrice: treatment && treatment.defaultPrice > 0 ? String(treatment.defaultPrice) : '' } : item) }));
  };

  const submitOrder = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (form.treatments.some((item) => !item.treatmentId)) { setError('Semua treatment wajib dipilih.'); return; }
    if (form.treatments.some((item) => !Number.isFinite(Number(item.originalPrice)) || Number(item.originalPrice) <= 0)) { setError('Harga aktual setiap treatment wajib diisi lebih dari 0.'); return; }
    const response = await fetch('/api/treatment-ops/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || 'Gagal membuat order'); return; }
    setQr(data.results.map((result: { order: OpsOrderView; qrToken: string }) => ({ orderNumber: result.order.orderNumber, url: `${window.location.origin}/treatment-ops/scan/${result.qrToken}` }))); setShowForm(false); await load();
  };

  const openQr = async (order: OpsOrderView) => {
    const response = await fetch(`/api/treatment-ops/orders/${order.id}/qr`, { method: 'POST' });
    const data = await response.json();
    if (!response.ok) { setError(data.error || 'Gagal membuat QR'); return; }
    setQr([{ orderNumber: order.orderNumber, url: `${window.location.origin}/treatment-ops/scan/${data.qrToken}` }]);
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

  const removeOrder = async (order: OpsOrderView) => {
    const confirmed = window.confirm(`Batalkan order ${order.orderNumber} untuk ${order.patientNameSnapshot}?`);
    if (!confirmed) return;
    const reason = window.prompt('Masukkan alasan pembatalan order:');
    if (reason === null) return;
    if (reason.trim().length < 2) { setError('Alasan pembatalan wajib diisi.'); return; }
    setError(''); setBusyAssign(order.id);
    try {
      const response = await fetch(`/api/treatment-ops/orders/${order.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: reason.trim() }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error || 'Order tidak dapat dibatalkan.'); return; }
      await load();
    } catch { setError('Gagal membatalkan order.'); }
    finally { setBusyAssign(null); }
  };

  const isStaffDayOff = (staffId: string, visitDate: string) => staffDayOffs.some(
    (dayOff) => dayOff.staffId === staffId && dayOff.date === dateKeyFromDate(visitDate),
  );

  const staffForAction = (action: OpsActionView, order: OpsOrderView) =>
    bootstrap?.assignableStaff.filter((staff) =>
      (!action.requiredRoleSnapshot || staff.role === action.requiredRoleSnapshot) &&
      (staff.id === action.assignedTherapistId || !isStaffDayOff(staff.id, order.visitDate)),
    ) || [];

  const canCreate = Boolean(bootstrap && ORDER_MANAGEMENT_ROLES.includes(bootstrap.staff.role));
  const canAssign = Boolean(bootstrap && ['SUPER_ADMIN', 'SUPERVISOR'].includes(bootstrap.staff.role));
  const canScan = bootstrap?.staff.role === 'SUPER_ADMIN';

  const isPersonalRole = Boolean(bootstrap && PERSONAL_ROLES.has(bootstrap.staff.role));
  const personalOrders = bootstrap
    ? orders.filter((order) => order.actions.some((action) => action.assignedTherapistId === bootstrap.staff.id || action.performedByTherapistId === bootstrap.staff.id))
    : [];
  const dashboardOrders = isPersonalRole ? personalOrders : orders;
  const personalActions = personalOrders.flatMap((order) => order.actions.filter((action) => action.assignedTherapistId === bootstrap?.staff.id || action.performedByTherapistId === bootstrap?.staff.id));
   const todayKey = dateKeyFromDate(new Date());
   const todayPersonalActions = personalOrders.flatMap((order) => dateKeyFromDate(order.visitDate) === todayKey
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
                    <p className="mt-1 text-xs text-white/45">{schedule(order)} · {order.doctor?.name || 'Tanpa dokter'} · {money(order.finalPrice)}</p>
                </div>
               <div className="flex flex-wrap gap-2"><button onClick={() => void openQr(order)} className="flex h-11 items-center justify-center gap-2 rounded-full border border-primary/30 px-5 text-xs font-bold text-primary transition hover:bg-primary hover:text-black"><QrCode className="size-4" /> Tampilkan QR</button>{canCreate && ['CREATED', 'ASSIGNED'].includes(order.status) && order.actions.every((action) => ['PENDING', 'ASSIGNED'].includes(action.status)) && <button disabled={busyAssign === order.id} onClick={() => void removeOrder(order)} className="flex h-11 items-center justify-center gap-2 rounded-full border border-red-400/30 px-4 text-xs font-bold text-red-300 transition hover:bg-red-500 hover:text-white disabled:opacity-50"><Trash2 className="size-4" /> Hapus</button>}</div>
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
                      {bootstrap?.assignableStaff.filter((staff) => !isStaffDayOff(staff.id, order.visitDate)).map((staff) => <option key={staff.id} value={staff.id}>{staff.name} · {roleLabel(staff.role)}</option>)}
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
                               <select value={action.assignedTherapistId || ''} onChange={(event) => void assign(action.id, event.target.value)} className="max-w-40 rounded-xl border border-white/15 bg-black/40 px-2 py-2 text-[10px] text-white outline-none focus:border-primary/60">
                                 <option value="">Assign eksekutor</option>
                                 {staffForAction(action, order).map((staff) => {
                                   const dayOff = isStaffDayOff(staff.id, order.visitDate);
                                   return <option key={staff.id} value={staff.id} disabled={dayOff}>{staff.name}{action.requiredRoleSnapshot ? '' : ` · ${roleLabel(staff.role)}`}{dayOff ? ' · Libur' : ''}</option>;
                                 })}
                                 {staffForAction(action, order).length === 0 && <option disabled>Tidak ada eksekutor tersedia</option>}
                               </select>
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
              <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{roleLabels[bootstrap.staff.role]}</p><h2 className="font-playfair mt-1 text-2xl font-bold">Order treatment baru</h2></div>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-full bg-white/10 p-2"><X className="size-5" /></button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cabang"><select required value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value, patientId: '' })}>{bootstrap.branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
               <Field label="Tanggal kunjungan"><input required type="date" value={form.visitDate} onChange={(e) => setForm({ ...form, visitDate: e.target.value })} /></Field>
               <Field label="Jam kunjungan"><input required type="time" value={form.visitTime} onChange={(e) => setForm({ ...form, visitTime: e.target.value })} /></Field>
              <AidoPatientPicker
                branchId={form.branchId}
                localPatients={bootstrap.patients.filter((item) => item.branchId === form.branchId)}
                value={form.patientId}
                onChange={(patientId) => setForm((current) => ({ ...current, patientId }))}
                canEnterManual={canCreate}
              />
              <Field label="Dokter"><select value={form.doctorId} onChange={(e) => setForm({ ...form, doctorId: e.target.value })}><option value="">Tanpa dokter</option>{bootstrap.doctors.filter((item) => item.branchId === form.branchId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
               <div className="sm:col-span-2"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold text-white/60">Treatment</span><button type="button" onClick={() => setForm((current) => ({ ...current, treatments: [...current.treatments, { treatmentId: '', originalPrice: '', discountAmount: '0' }] }))} className="flex items-center gap-1 rounded-full border border-primary/40 px-3 py-1.5 text-[10px] font-bold text-primary hover:bg-primary hover:text-black"><Plus className="size-3" /> Tambah treatment</button></div><div className="space-y-3">{form.treatments.map((item, index) => <div key={index} className="rounded-2xl border border-white/10 bg-black/20 p-3"><div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-bold text-primary">Treatment {index + 1}</span>{form.treatments.length > 1 && <button type="button" onClick={() => setForm((current) => ({ ...current, treatments: current.treatments.filter((_, itemIndex) => itemIndex !== index) }))} className="text-white/45 hover:text-red-300"><X className="size-4" /></button>}</div><label className="block text-xs font-bold text-white/60">Nama treatment<TreatmentPicker treatments={bootstrap.treatments} value={item.treatmentId} onChange={(id) => selectTreatment(index, id)} /></label><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Harga aktual"><input required inputMode="numeric" value={item.originalPrice} onChange={(e) => setForm((current) => ({ ...current, treatments: current.treatments.map((currentItem, itemIndex) => itemIndex === index ? { ...currentItem, originalPrice: e.target.value } : currentItem) }))} /></Field><Field label="Diskon"><input inputMode="numeric" value={item.discountAmount} onChange={(e) => setForm((current) => ({ ...current, treatments: current.treatments.map((currentItem, itemIndex) => itemIndex === index ? { ...currentItem, discountAmount: e.target.value } : currentItem) }))} /></Field></div></div>)}</div></div>
              <Field label="Catatan internal"><input value={form.internalNote} onChange={(e) => setForm({ ...form, internalNote: e.target.value })} placeholder="Opsional" /></Field>
            </div>
            <button className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-black transition hover:bg-primary-light"><Plus className="size-4" /> Buat order & QR</button>
          </form>
        </div>
      )}

      {qr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="fo-glass-modal max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] p-7 text-center">
             <div className="mb-5 flex items-center justify-between"><span className="text-xs font-bold text-primary">{qr.length} order berhasil dibuat</span><button onClick={() => setQr(null)}><X className="size-5" /></button></div>
             <div className="grid gap-5 sm:grid-cols-2">{qr.map((item) => <div key={item.orderNumber}><div className="mx-auto w-fit rounded-3xl bg-white p-4"><QRCodeCanvas value={item.url} size={200} level="H" /></div><p className="mt-3 text-xs font-bold text-primary">{item.orderNumber}</p></div>)}</div>
             <h3 className="font-playfair mt-5 text-xl font-bold">QR Order Treatment</h3>
             <p className="mt-2 text-xs leading-5 text-white/50">Tampilkan QR sesuai treatment kepada terapis. Jangan membagikannya di luar operasional klinik.</p>
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

type TreatmentPickerProps = {
  treatments: OpsBootstrap['treatments'];
  value: string;
  onChange: (id: string) => void;
};

function TreatmentPicker({ treatments, value, onChange }: TreatmentPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);
  const selected = treatments.find((item) => item.id === value);
  const normalizedQuery = query.trim().toLocaleLowerCase('id-ID');
  const filteredTreatments = treatments.filter((item) =>
    [item.name, item.code, item.category || ''].some((field) => field.toLocaleLowerCase('id-ID').includes(normalizedQuery)),
  );

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [open]);

  const chooseTreatment = (id: string) => {
    onChange(id);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={pickerRef} className="relative mt-1.5">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-xl bg-black/30 px-3 text-left text-sm text-white ring-1 ring-white/20 outline-none transition hover:ring-primary/50 focus:ring-primary/60"
      >
        <span className={selected ? 'truncate' : 'truncate text-white/50'}>{selected?.name || 'Pilih treatment'}</span>
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
              placeholder="Cari nama atau kode treatment"
              aria-label="Cari treatment"
              className="h-11 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            />
          </div>
          <div role="listbox" aria-label="Daftar treatment" className="max-h-64 overflow-y-auto p-1.5">
            {filteredTreatments.length === 0 ? (
              <p className="px-3 py-5 text-center text-xs text-white/40">Treatment tidak ditemukan.</p>
            ) : filteredTreatments.map((item) => {
              const priceReady = item.defaultPrice > 0;
              const stepsReady = item.actionTemplates.length > 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={item.id === value}
                  onClick={() => chooseTreatment(item.id)}
                  className="flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/10 aria-selected:bg-primary/10"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">{item.name}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-white/45">
                      {item.code}{item.category ? ` · ${item.category}` : ''} · {item.active ? 'Aktif' : 'Belum aktif'}
                    </span>
                    <span className={`mt-0.5 block text-[10px] ${priceReady && stepsReady ? 'text-emerald-300/70' : 'text-amber-300/80'}`}>
                      {priceReady ? `Default ${money(item.defaultPrice)}` : 'Harga belum diatur'}{!stepsReady ? ' · Tahapan belum tersedia' : ''}
                    </span>
                  </span>
                  {item.id === value && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
