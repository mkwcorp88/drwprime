'use client';
/* eslint-disable @next/next/no-img-element -- private, cookie-protected document previews must not use the shared image optimizer. */

import { useState, type FormEvent } from 'react';
import { FileUp, ArrowRight } from 'lucide-react';
import { CRM_SOURCES, CRM_PLATFORMS } from '@/lib/crm/constants';
import { action, request, type Bootstrap, type ImportBatch, type ImportRow } from './types';

export default function ImportPanel({ data, onDone }: { data: Bootstrap; onDone: (message: string) => void }) {
  const [source, setSource] = useState('EVENT');
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await request<ImportBatch>('/api/crm/import', { method: 'POST', body: new FormData(event.currentTarget) });
      setBatch(result); setRows(result.rows);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Dokumen belum berhasil dibaca.'); }
    finally { setBusy(false); }
  }
  function change(index: number, values: Partial<ImportRow>) { setRows((current) => current.map((row, i) => i === index ? { ...row, ...values } : row)); }
  async function save() {
    if (!batch) return;
    setBusy(true); setError('');
    try {
      const result = await action<{ created: number; duplicates: number; linked: number }>('save_import', { id: batch.id, rows });
      onDone(`${result.created} kontak baru disimpan. ${result.duplicates} nomor sudah ada; ${result.linked} riwayat event ditambahkan.`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Kontak belum berhasil disimpan.'); }
    finally { setBusy(false); }
  }
  async function discard() {
    if (!batch) return;
    setBusy(true); setError('');
    try { await action('discard_import', { id: batch.id }); setBatch(null); setRows([]); setFileNames([]); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Pratinjau belum dapat dibatalkan.'); }
    finally { setBusy(false); }
  }
  return <>
    <div className="crm-steps">{['Pilih & upload','Periksa data','Simpan kontak'].map((step, i) => <div className={`crm-step ${(batch ? i === 1 : i === 0) ? 'active' : ''}`} key={step}><span>{i + 1}</span><div><strong>{step}</strong><small>{['Pilih sumber kontak','Koreksi hasil pembacaan','Siap ditindaklanjuti'][i]}</small></div></div>)}</div>
    {error && <div className="crm-alert error" role="alert">{error}</div>}
    {!batch && !data.ocrReady && <div className="crm-alert info">Impor Excel/CSV siap digunakan. Pembacaan foto dan PDF perlu diaktifkan oleh admin CRM.</div>}
    {!batch ? <form onSubmit={upload}>
      <section className="crm-card"><div className="crm-card-head"><div><span className="crm-eyebrow">Langkah 1 dari 3</span><h2>Asal database</h2><p className="crm-muted crm-small">Berlaku untuk seluruh kontak dalam upload.</p></div></div><div className="crm-grid">
        <label className="crm-field">Sumber kontak <b>*</b><select name="source" value={source} onChange={(e) => setSource(e.target.value)}>{Object.entries(CRM_SOURCES).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
        {source === 'EVENT' && <label className="crm-field">Event <b>*</b><select name="eventId" required defaultValue=""><option value="">Pilih event</option>{data.events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><small>Belum ada? Tambahkan melalui menu Event.</small></label>}
        {source === 'ADS' && <label className="crm-field">Campaign <b>*</b><select name="campaignId" required defaultValue=""><option value="">Pilih campaign</option>{data.campaigns.filter((item) => item.status === 'ACTIVE').map((item) => <option key={item.id} value={item.id}>{item.name} · {CRM_PLATFORMS[item.platform as keyof typeof CRM_PLATFORMS]}</option>)}</select></label>}
        <label className="crm-field">PIC untuk kontak baru<select name="assignedTo" defaultValue={data.actor.id}><option value="">Tentukan nanti</option>{data.assignees.map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}</select></label>
      </div></section>
      <section className="crm-card"><div className="crm-card-head"><div><span className="crm-eyebrow">Dokumen kontak</span><h2>Pilih file</h2><p className="crm-muted crm-small">Foto kertas, PDF, Excel (.xlsx), atau CSV.</p></div></div>
        <label className="crm-upload"><span className="crm-upload-icon"><FileUp size={22} /></span><strong>Pilih foto atau dokumen</strong><span className="crm-muted crm-small">Hingga 3 file, maksimal 5 MB per file dan 100 kontak per batch</span><span className="crm-upload-picker" aria-hidden="true">Pilih file</span><span className="crm-upload-selection" aria-live="polite">{fileNames.length ? fileNames.join(' · ') : 'Belum ada file dipilih'}</span><input className="crm-file-input" type="file" name="documents" aria-label="Pilih foto atau dokumen" accept=".jpg,.jpeg,.png,.pdf,.xlsx,.csv" multiple required onChange={(event) => setFileNames(Array.from(event.currentTarget.files || []).map((file) => file.name))} /></label>
        <p className="crm-muted crm-small" style={{ marginTop: 15 }}>Untuk Excel/CSV gunakan kolom <strong>Nama</strong> dan <strong>WhatsApp</strong>; layanan dan catatan opsional. <a className="crm-link-text" href="/crm-template-leads.csv" download>Unduh contoh CSV ↓</a></p>
        <p className="crm-muted crm-small" style={{ marginTop: 9 }}>Foto/PDF diproses melalui Google Gemini. Periksa setiap hasil, terutama nomor WhatsApp.</p>
      </section><div className="crm-actions"><button className="crm-btn primary" disabled={busy}>{busy ? 'Membaca dokumen…' : <>Baca dokumen <ArrowRight size={15} /></>}</button></div>
    </form> : <>
      <div className="crm-alert info">Cocokkan setiap nama dan nomor WhatsApp dengan dokumen asli. Lepaskan centang untuk baris yang tidak ingin disimpan.</div>
      <div className={`crm-review ${batch.files.length ? '' : 'no-files'}`}><section className="crm-card"><div className="crm-card-head"><div><span className="crm-eyebrow">Langkah 2 dari 3</span><h2>Periksa hasil</h2><p className="crm-muted crm-small">{rows.length} kontak terbaca · DRW Prime</p></div></div>
        <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Simpan</th><th>Nama *</th><th>WhatsApp *</th><th>Layanan</th><th>Catatan</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}><td><label><input className="crm-check" aria-label={`Simpan baris ${index + 1}`} type="checkbox" checked={row.selected} onChange={(e) => change(index, { selected: e.target.checked })} /> <span className="crm-small">{index + 1}</span></label></td><td><input aria-label={`Nama baris ${index + 1}`} maxLength={100} value={row.name} onChange={(e) => change(index, { name: e.target.value })} /><small>{row.file}</small></td><td><input aria-label={`WhatsApp baris ${index + 1}`} inputMode="tel" maxLength={40} value={row.phone} onChange={(e) => change(index, { phone: e.target.value, duplicate: null, invalidPhone: false, repeated: false })} />{row.duplicate && <small className="crm-warning">Sudah ada: {row.duplicate.name}</small>}{row.repeated && <small className="crm-warning">Nomor berulang dalam batch</small>}{row.invalidPhone && <small className="crm-warning">Periksa nomor</small>}</td><td><input aria-label={`Layanan baris ${index + 1}`} maxLength={150} value={row.interest} onChange={(e) => change(index, { interest: e.target.value })} /></td><td><input aria-label={`Catatan baris ${index + 1}`} maxLength={2000} value={row.notes} onChange={(e) => change(index, { notes: e.target.value })} /></td></tr>)}</tbody></table></div>
        <p className="crm-muted crm-small" style={{ marginTop: 14 }}>Kontak yang sudah ada tidak ditimpa. Untuk event, riwayat event baru ditambahkan ke kontak tersebut.</p><div className="crm-actions"><button type="button" className="crm-btn light" disabled={busy} onClick={discard}>Batalkan</button><button type="button" className="crm-btn primary" disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan kontak terpilih →'}</button></div>
      </section>{batch.files.length > 0 && <aside className="crm-card crm-original"><div className="crm-card-head"><div><span className="crm-eyebrow">Dokumen asli</span><h2>Bandingkan hasil</h2></div></div>{batch.files.map((file) => { const url = `/api/crm/import/${batch.id}/${file.id}`; return <div key={file.id} style={{ marginBottom: 18 }}><a className="crm-link-text" href={url} target="_blank" rel="noopener noreferrer">↗ {file.name}</a>{file.mime.startsWith('image/') && <a href={url} target="_blank" rel="noopener noreferrer">{/* Private authenticated image cannot use the shared image optimizer. */}<img src={url} alt={`Dokumen ${file.name}`} /></a>}</div>; })}</aside>}</div>
    </>}
  </>;
}
