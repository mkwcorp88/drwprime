'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Camera, Check, CheckCircle2, Clock3, Play, RefreshCw, ScanLine, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { OpsActionView, OpsOrderView } from '@/types/treatment-operations';

type ScanPayload = { actor: { id: string; name: string; role: string }; order: OpsOrderView };
const money = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

export function ScanLanding() {
  const router = useRouter();
  const [code, setCode] = useState('');
  return (
    <div className="mx-auto max-w-lg py-10 sm:py-20">
      <div className="fo-glass-card rounded-[2rem] p-7 sm:p-10">
        <ScanLine className="size-10 text-primary" />
        <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.24em] text-primary">Terapis</p>
        <h1 className="font-playfair mt-2 text-4xl font-bold leading-tight">Scan order,<br />mulai tindakan.</h1>
        <p className="mt-4 text-sm leading-6 text-white/60">Arahkan kamera ke QR order pasien. Sebagai fallback, tempel URL atau token QR di bawah ini.</p>
        <div className="mt-8 rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10">
          <div className="flex items-center gap-3 text-xs text-white/55"><Camera className="size-4" /> Pemindai kamera tersedia melalui QR kamera ponsel</div>
          <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Tempel token atau URL QR" className="mt-4 h-12 w-full rounded-xl bg-black/30 px-4 text-sm outline-none ring-1 ring-white/20 placeholder:text-white/25 focus:ring-primary/60" />
          <button onClick={() => { const token = code.trim().split('/').filter(Boolean).pop(); if (token) router.push(`/treatment-ops/scan/${token}`); }} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-black transition hover:bg-primary-light"><ArrowRight className="size-4" /> Buka order</button>
        </div>
      </div>
    </div>
  );
}

export function ScannedOrder({ token }: { token: string }) {
  const [data, setData] = useState<ScanPayload | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = async () => {
    setError('');
    const response = await fetch(`/api/treatment-ops/scan/${token}`);
    const payload = await response.json();
    if (!response.ok) setError(payload.error || 'QR tidak dapat dibuka'); else setData(payload);
  };
  useEffect(() => {
    let active = true;
    void fetch(`/api/treatment-ops/scan/${token}`).then(async (response) => {
      const payload = await response.json();
      if (!active) return;
      if (!response.ok) setError(payload.error || 'QR tidak dapat dibuka');
      else setData(payload);
    });
    return () => { active = false; };
  }, [token]);

  const mutate = async (action: OpsActionView, operation: 'start' | 'complete') => {
    setBusy(action.id); setError('');
    const response = await fetch(`/api/treatment-ops/actions/${action.id}/${operation}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const payload = await response.json();
    if (!response.ok) setError(payload.error || 'Tindakan gagal diproses'); else await load();
    setBusy('');
  };

  if (error && !data) return <div className="mx-auto max-w-md py-20 text-center"><ScanLine className="mx-auto size-12 text-red-400" /><h1 className="mt-5 text-2xl font-bold">QR tidak dapat dibuka</h1><p className="mt-2 text-sm text-white/55">{error}</p></div>;
  if (!data) return <div className="py-24 text-center text-sm text-white/50">Membaca QR order...</div>;
  const completed = data.order.actions.filter((action) => action.status === 'COMPLETED').length;
  const progress = Math.round(completed / data.order.actions.length * 100);
  return (
    <div className="mx-auto max-w-2xl">
      <section className="fo-glass-card overflow-hidden rounded-[2rem]">
        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between"><span className="rounded-full bg-primary/15 px-3 py-1.5 text-[10px] font-bold tracking-[0.14em] text-primary">{data.order.orderNumber}</span><button onClick={() => void load()} className="rounded-full bg-white/10 p-2 text-white/70 hover:text-primary"><RefreshCw className="size-4" /></button></div>
          <p className="mt-8 text-xs text-primary">Pasien</p>
          <h1 className="font-playfair mt-1 text-3xl font-bold">{data.order.patientNameSnapshot}</h1>
          <p className="mt-2 text-sm text-white/60">{data.order.treatmentNameSnapshot}</p>
          <div className="mt-7 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div><span className="text-xs font-bold">{progress}%</span></div>
        </div>
        <div className="grid grid-cols-2 border-t border-white/10 bg-black/20">
          <div className="border-r border-white/10 p-4"><p className="text-[10px] text-white/40">Terapis login</p><p className="mt-1 flex items-center gap-2 text-xs font-bold"><UserRound className="size-4 text-primary" />{data.actor.name}</p></div>
          <div className="p-4"><p className="text-[10px] text-white/40">Estimasi insentif</p><p className="mt-1 flex items-center gap-2 text-xs font-bold"><CheckCircle2 className="size-4 text-primary" />{money(data.order.actions.reduce((sum, action) => sum + Number(action.calculatedIncentive ?? action.incentiveValueSnapshot), 0))}</p></div>
        </div>
      </section>

      {error && <div className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-playfair text-lg font-bold">Tahapan tindakan</h2><span className="text-xs text-white/45">{completed}/{data.order.actions.length} selesai</span></div>
        <div className="space-y-3">
          {data.order.actions.map((action, index) => {
            const available = ['PENDING', 'ASSIGNED'].includes(action.status) && !data.order.actions.some((before) => before.sequenceNumber < action.sequenceNumber && before.isRequired && before.status !== 'COMPLETED');
            const mine = action.performedByTherapistId === data.actor.id;
            return (
              <article key={action.id} className={`rounded-3xl p-4 ring-1 ${action.status === 'ON_PROCESS' ? 'bg-primary/10 ring-primary/30' : action.status === 'COMPLETED' ? 'bg-emerald-400/10 ring-emerald-400/20' : 'bg-white/[0.03] ring-white/10'}`}>
                <div className="flex gap-3">
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${action.status === 'COMPLETED' ? 'bg-emerald-500 text-black' : action.status === 'ON_PROCESS' ? 'bg-primary text-black' : 'bg-white/10 text-white/45'}`}>{action.status === 'COMPLETED' ? <Check className="size-4" /> : index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div><h3 className="font-bold">{action.actionNameSnapshot}</h3><p className="mt-1 text-[11px] text-white/45">{action.performedTherapist?.name || action.assignedTherapist?.name || (action.isRequired ? 'Tindakan wajib' : 'Tindakan opsional')}</p></div>
                      <span className="shrink-0 text-xs font-bold text-primary">{money(Number(action.calculatedIncentive ?? action.incentiveValueSnapshot))}</span>
                    </div>
                    {data.actor.role === 'THERAPIST' && available && (!action.assignedTherapistId || action.assignedTherapistId === data.actor.id) && <button disabled={busy === action.id} onClick={() => void mutate(action, 'start')} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-bold text-black transition hover:bg-primary-light disabled:opacity-50"><Play className="size-4" /> Mulai tindakan</button>}
                    {data.actor.role === 'THERAPIST' && action.status === 'ON_PROCESS' && mine && <button disabled={busy === action.id} onClick={() => void mutate(action, 'complete')} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 text-xs font-bold text-primary transition hover:bg-primary hover:text-black disabled:opacity-50"><Clock3 className="size-4" /> Selesaikan tindakan</button>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
