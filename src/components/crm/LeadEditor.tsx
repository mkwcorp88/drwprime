'use client';

import { useState, type FormEvent } from 'react';
import { CRM_PLATFORMS, CRM_SOURCES } from '@/lib/crm/constants';
import { action, type Bootstrap, type Lead } from './types';

export default function LeadEditor({ lead, data, onCancel, onSaved }: { lead: Lead | null; data: Bootstrap; onCancel: () => void; onSaved: (id: string) => void }) {
  const [source, setSource] = useState(lead?.source || 'EVENT');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { const result = await action<{ id: string }>('save_lead', { ...values, id: lead?.id || '', revision: lead?.revision || 0 }); onSaved(result.id); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Kontak belum berhasil disimpan.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit}><section className="crm-card"><div className="crm-card-head"><div><span className="crm-eyebrow">Data kontak</span><h2>Informasi utama</h2><p className="crm-muted crm-small">Nama dan WhatsApp membantu tim menindaklanjuti kontak.</p></div></div>{error && <div className="crm-alert error" role="alert">{error}</div>}<div className="crm-grid">
    <label className="crm-field">Nama <b>*</b><input name="name" defaultValue={lead?.name || ''} maxLength={100} required /></label>
    <label className="crm-field">Nomor WhatsApp <b>*</b><input name="phone" defaultValue={lead?.phone || ''} inputMode="tel" maxLength={40} required placeholder="0812..." /></label>
    <label className="crm-field">Sumber kontak <b>*</b><select name="source" value={source} onChange={(e) => setSource(e.target.value)}>{Object.entries(CRM_SOURCES).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
    {source === 'EVENT' && <label className="crm-field">Event <b>*</b><select name="eventId" defaultValue={lead?.eventId || ''} required><option value="">Pilih event</option>{data.events.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><small>Tambahkan event terlebih dahulu dari menu Event.</small></label>}
    {source === 'ADS' && <label className="crm-field">Campaign <b>*</b><select name="campaignId" defaultValue={lead?.campaignId || ''} required><option value="">Pilih campaign</option>{data.campaigns.filter((item) => item.status === 'ACTIVE' || item.id === lead?.campaignId).map((item) => <option value={item.id} key={item.id}>{item.name} · {CRM_PLATFORMS[item.platform as keyof typeof CRM_PLATFORMS]}</option>)}</select></label>}
    <label className="crm-field">PIC<select name="assignedTo" defaultValue={lead?.assignedTo || ''}><option value="">Belum ditentukan</option>{data.assignees.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
    <label className="crm-field">Layanan diminati<input name="interest" maxLength={150} defaultValue={lead?.interest || ''} placeholder="Contoh: facial" /></label>
    <label className="crm-field full">Catatan<textarea name="notes" maxLength={2000} defaultValue={lead?.notes || ''} placeholder="Catatan singkat untuk tim" /></label>
  </div></section><div className="crm-actions"><button type="button" className="crm-btn light" onClick={onCancel}>Batal</button><button className="crm-btn primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan kontak →'}</button></div></form>;
}
