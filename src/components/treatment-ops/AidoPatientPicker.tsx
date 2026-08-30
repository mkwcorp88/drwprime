'use client';

import { useEffect, useState } from 'react';
import { Check, Database, Loader2, Search, UserRound, X } from 'lucide-react';

const AIDO_SEARCH_ENABLED = false;

type LocalPatient = {
  id: string;
  patientNumber: string;
  name: string;
  source: 'AIDO' | 'MANUAL';
};

export type AidoPatientResult = {
  externalPatientId: string;
  externalPatientNumericId: string | null;
  name: string;
  phone: string | null;
  mrNumber: string | null;
};

type SelectedPatient = {
  id: string;
  name: string;
  meta: string;
  source: 'AIDO' | 'MANUAL';
};

export default function AidoPatientPicker({
  branchId,
  localPatients,
  value,
  onChange,
  canEnterManual,
}: {
  branchId: string;
  localPatients: LocalPatient[];
  value: string;
  onChange: (patientId: string) => void;
  canEnterManual: boolean;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AidoPatientResult[]>([]);
  const [selected, setSelected] = useState<SelectedPatient | null>(null);
  const [searching, setSearching] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [savingManual, setSavingManual] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSelected(null);
    setResults([]);
    setQuery('');
    setManualOpen(false);
    setError('');
  }, [branchId]);

  useEffect(() => {
    if (!AIDO_SEARCH_ENABLED) {
      setResults([]);
      setSearching(false);
      return;
    }
    const normalizedQuery = query.trim();
    if (manualOpen || normalizedQuery.length < 2 || selected) {
      setResults([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setError('');
      try {
        const response = await fetch(`/api/treatment-ops/patients?q=${encodeURIComponent(normalizedQuery)}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || 'Data pasien AIDO tidak dapat dimuat.');
        setResults(data.patients || []);
      } catch (caught) {
        if (!controller.signal.aborted) {
          setResults([]);
          setError(caught instanceof Error ? caught.message : 'Data pasien AIDO tidak dapat dimuat.');
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [manualOpen, query, selected]);

  const selectLocal = (patientId: string) => {
    if (!patientId) return;
    const patient = localPatients.find((item) => item.id === patientId);
    if (!patient) return;
    setSelected({ id: patient.id, name: patient.name, meta: patient.patientNumber, source: patient.source });
    setQuery('');
    setResults([]);
    setError('');
    onChange(patient.id);
  };

  const selectAido = async (patient: AidoPatientResult) => {
    setSavingId(patient.externalPatientId);
    setError('');
    try {
      const response = await fetch('/api/treatment-ops/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId, aidoPatientId: patient.externalPatientId }),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 401) {
        window.location.href = '/treatment-ops/login';
        return;
      }
      if (!response.ok) throw new Error(data?.error || 'Pasien AIDO tidak dapat dipilih.');

      setSelected({
        id: data.patient.id,
        name: data.patient.name,
        meta: patient.mrNumber || patient.phone || 'Data AIDO',
        source: 'AIDO',
      });
      setQuery('');
      setResults([]);
      onChange(data.patient.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Pasien AIDO tidak dapat dipilih.');
    } finally {
      setSavingId(null);
    }
  };

  const openManual = () => {
    setManualOpen(true);
    setQuery('');
    setResults([]);
    setError('');
  };

  const saveManual = async () => {
    setSavingManual(true);
    setError('');
    try {
      const response = await fetch('/api/treatment-ops/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          source: 'MANUAL',
          name: manualName,
          phone: manualPhone,
        }),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 401) {
        window.location.href = '/treatment-ops/login';
        return;
      }
      if (!response.ok) throw new Error(data?.error || 'Pasien tidak dapat disimpan.');

      setSelected({ id: data.patient.id, name: data.patient.name, meta: data.patient.patientNumber, source: 'MANUAL' });
      setManualOpen(false);
      setManualName('');
      setManualPhone('');
      onChange(data.patient.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Pasien tidak dapat disimpan.');
    } finally {
      setSavingManual(false);
    }
  };

  const clear = () => {
    setSelected(null);
    setQuery('');
    setResults([]);
    setManualOpen(false);
    setError('');
    onChange('');
  };

  return (
    <div className="block text-xs font-bold text-white/60">
      <span>Pasien</span>
      <input type="hidden" required value={value} readOnly aria-label="Pasien terpilih" />
      <div className="mt-1.5 space-y-2">
        {selected ? (
          <div className="flex items-center gap-3 rounded-[16px] border border-primary/35 bg-primary/10 px-3.5 py-3 text-white">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Check className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{selected.name}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-normal text-white/50">
                {selected.source === 'AIDO' && <Database className="size-3 text-primary/70" />}
                {selected.source === 'AIDO' ? 'AIDO' : 'Manual'} · {selected.meta}
              </p>
            </div>
            <button type="button" onClick={clear} className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white/45 transition hover:bg-white/10 hover:text-white" aria-label="Ganti pasien">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {AIDO_SEARCH_ENABLED && (
              <div className="flex min-h-12 items-center gap-3 rounded-[16px] border border-white/15 bg-black/30 px-3.5 ring-1 ring-white/5 focus-within:border-primary/60 focus-within:ring-primary/25">
                <Search className="size-4 shrink-0 text-white/35" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari nama atau No. RM di AIDO"
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent py-3 text-sm font-normal text-white outline-none placeholder:text-white/30"
                />
                {searching && <Loader2 className="size-4 shrink-0 animate-spin text-primary" />}
              </div>
            )}

            {localPatients.length > 0 && (
              <select value="" onChange={(event) => selectLocal(event.target.value)} className="h-11 w-full rounded-[16px] border border-white/10 bg-white/[0.04] px-3 text-xs font-normal text-white/65 outline-none focus:border-primary/50 [&>option]:bg-[#0a0a0a]">
                <option value="">Pilih pasien tersimpan</option>
                {localPatients.map((patient) => <option key={patient.id} value={patient.id}>{patient.patientNumber} · {patient.name}</option>)}
              </select>
            )}

            {canEnterManual && !manualOpen && (
              <button type="button" onClick={openManual} className="flex w-full items-center justify-center rounded-[16px] border border-primary/25 bg-primary/[0.06] px-3 py-3 text-xs font-semibold text-primary transition hover:bg-primary/10">
                + Tambah pasien manual
              </button>
            )}
          </div>
        )}

        {!selected && manualOpen && (
          <div className="rounded-[18px] border border-primary/25 bg-primary/[0.06] p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Daftarkan pasien</p>
                <p className="mt-1 text-[11px] font-normal leading-5 text-white/45">Data disimpan di sistem operasional klinik.</p>
              </div>
              <button type="button" onClick={() => setManualOpen(false)} className="flex size-8 shrink-0 items-center justify-center rounded-xl text-white/45 hover:bg-white/10 hover:text-white" aria-label="Tutup pendaftaran pasien">
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-[11px] font-semibold text-white/60">Nama pasien<input required value={manualName} onChange={(event) => setManualName(event.target.value)} maxLength={120} placeholder="Nama lengkap pasien" autoComplete="name" className="mt-1.5 h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-sm font-normal text-white outline-none placeholder:text-white/30 focus:border-primary/60" /></label>
              <label className="block text-[11px] font-semibold text-white/60">Nomor WhatsApp <span className="font-normal text-white/35">(opsional)</span><input value={manualPhone} onChange={(event) => setManualPhone(event.target.value)} maxLength={24} placeholder="08xx atau +62xx" inputMode="tel" autoComplete="tel" className="mt-1.5 h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-sm font-normal text-white outline-none placeholder:text-white/30 focus:border-primary/60" /></label>
              <button type="button" onClick={() => void saveManual()} disabled={savingManual} className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-xs font-bold text-black transition hover:bg-primary-light disabled:opacity-50">
                {savingManual && <Loader2 className="size-4 animate-spin" />} Simpan pasien
              </button>
            </div>
          </div>
        )}

        {AIDO_SEARCH_ENABLED && !selected && query.trim().length >= 2 && !searching && results.length > 0 && (
          <div className="mobile-surface-soft max-h-64 overflow-y-auto rounded-2xl p-1.5" role="listbox" aria-label="Hasil pasien AIDO">
            {results.map((patient) => (
              <button key={patient.externalPatientId} type="button" onClick={() => void selectAido(patient)} disabled={savingId !== null} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-primary/10 disabled:opacity-50">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><UserRound className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{patient.name}</span>
                  <span className="mt-0.5 block truncate text-[10px] font-normal text-white/45">{patient.mrNumber || 'No. RM belum tersedia'}{patient.phone ? ` · ${patient.phone}` : ''}</span>
                </span>
                {savingId === patient.externalPatientId ? <Loader2 className="size-4 animate-spin text-primary" /> : <span className="text-[10px] font-semibold text-primary">Pilih</span>}
              </button>
            ))}
          </div>
        )}

        {AIDO_SEARCH_ENABLED && !selected && query.trim().length >= 2 && !searching && results.length === 0 && !error && (
          <p className="rounded-xl bg-white/[0.03] px-3 py-2.5 text-[11px] font-normal text-white/45">Pasien tidak ditemukan di AIDO.</p>
        )}

        {error && <p className="text-[11px] font-normal text-red-300" role="alert">{error}</p>}
      </div>
    </div>
  );
}
