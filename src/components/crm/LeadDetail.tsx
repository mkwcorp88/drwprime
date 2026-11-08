'use client';

import { useRef, useState, type FormEvent } from 'react';
import { CRM_BOOKING_ROLES, CRM_SOURCES, CRM_STATUSES, CRM_WRITE_ROLES } from '@/lib/crm/constants';
import { action, dateText, label, money, type Bootstrap, type Lead } from './types';

export default function LeadDetail({ lead, data, onEdit, onRefresh, onBooking }: { lead: Lead; data: Bootstrap; onEdit: () => void; onRefresh: () => void; onBooking: () => void }) {
  const [booking, setBooking] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const requestKey = useRef<string | null>(null);
  const canWrite = CRM_WRITE_ROLES.includes(data.role), canBook = CRM_BOOKING_ROLES.includes(data.role);
  async function followUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    const form = event.currentTarget, values = Object.fromEntries(new FormData(form).entries());
    try { await action('follow_up', { ...values, id: lead.id, revision: lead.revision }); form.reset(); setNotice('Tindak lanjut berhasil dicatat.'); onRefresh(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Tindak lanjut belum berhasil disimpan.'); }
    finally { setBusy(false); }
  }
  async function createBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    requestKey.current ||= crypto.randomUUID();
    try {
      await action('create_reservation', { ...Object.fromEntries(new FormData(event.currentTarget).entries()), leadId: lead.id, requestKey: requestKey.current });
      requestKey.current = null; setBooking(false); onBooking();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Reservasi belum berhasil disimpan.'); }
    finally { setBusy(false); }
  }
  async function recordResult(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { await action('update_reservation', { id, operation: 'visit_result', visitResult: new FormData(event.currentTarget).get('visitResult') }); setNotice('Hasil kunjungan berhasil disimpan.'); onRefresh(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Hasil kunjungan belum berhasil disimpan.'); }
    finally { setBusy(false); }
  }
  const whatsapp = `https://wa.me/${lead.phoneNormalized}?text=${encodeURIComponent(`Halo Kak ${lead.name}, saya dari DRW Prime. Ada yang bisa kami bantu?`)}`;
  return <>
    {error && <div className="crm-alert error" role="alert">{error}</div>}{notice && <div className="crm-alert" role="status">{notice}</div>}
    <section className="crm-card"><div className="crm-card-head"><div><span className="crm-eyebrow">Data kontak</span><h2>{lead.name}</h2><p className="crm-muted crm-small">{lead.phone} · {label(CRM_SOURCES, lead.source)}</p></div><div className="crm-row">{canWrite && lead.status !== 'NOT_INTERESTED' && <a className="crm-btn light small" href={whatsapp} target="_blank" rel="noopener noreferrer">↗ WhatsApp</a>}{canWrite && <button type="button" className="crm-btn light small" onClick={onEdit}>Edit</button>}{canBook && <button type="button" className="crm-btn primary small" onClick={() => setBooking((v) => !v)}>+ Buat reservasi</button>}</div></div>
      <div className="crm-grid"><p className="crm-small"><strong>Status</strong><br /><span className="crm-pill">{label(CRM_STATUSES, lead.status)}</span></p><p className="crm-small"><strong>PIC</strong><br />{data.assignees.find((a) => a.id === lead.assignedTo)?.name || 'Belum ditentukan'}</p><p className="crm-small"><strong>Layanan diminati</strong><br />{lead.interest || '—'}</p><p className="crm-small"><strong>Hubungi lagi</strong><br />{dateText(lead.nextFollowUp)}</p><p className="crm-small full"><strong>Catatan</strong><br />{lead.notes || '—'}</p></div>
    </section>
    {booking && <form onSubmit={createBooking}><section className="crm-card"><div className="crm-card-head"><div><span className="crm-eyebrow">Reservasi Prime</span><h2>Buat reservasi</h2><p className="crm-muted crm-small">Kontak sudah terisi. Lengkapi detail booking.</p></div></div><div className="crm-grid">
      <label className="crm-field">Treatment <b>*</b><select name="treatmentId" required defaultValue=""><option value="">Pilih treatment</option>{data.treatments.map((item) => <option key={item.id} value={item.id}>{item.name} · {money(item.price)}</option>)}</select></label>
      <label className="crm-field">Email pasien <b>*</b><input name="email" type="email" required maxLength={254} placeholder="nama@email.com" /></label>
      <label className="crm-field">Tanggal <b>*</b><input name="date" type="date" required /></label><label className="crm-field">Jam <b>*</b><input name="time" type="time" required /></label>
      {lead.source === 'EVENT' && <label className="crm-field">Event terkait <b>*</b><select name="eventId" defaultValue={lead.eventId || ''} required><option value="">Pilih event</option>{lead.events?.map(({ event }) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label>}
      <label className="crm-field">Kode affiliate<input name="referral" maxLength={10} placeholder="Opsional" /></label>
      </div><div className="crm-actions"><button type="button" className="crm-btn light" onClick={() => setBooking(false)}>Batal</button><button className="crm-btn primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan reservasi →'}</button></div></section></form>}
    <section className="crm-card"><div className="crm-card-head"><div><span className="crm-eyebrow">Tindak lanjut</span><h2>Riwayat & langkah berikutnya</h2></div></div>{canWrite && <form onSubmit={followUp}><div className="crm-grid"><label className="crm-field">Hasil <b>*</b><select name="status" required defaultValue=""><option value="">Pilih hasil</option>{Object.entries(CRM_STATUSES).filter(([key]) => key !== 'NEW').map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label><label className="crm-field">Hubungi lagi pada<input name="nextFollowUp" type="date" /><small>Wajib untuk hasil “Hubungi lagi nanti”.</small></label>{Boolean(lead.events?.length) && <label className="crm-field">Event terkait<select name="eventId" defaultValue={lead.eventId || ''}><option value="">Tidak terkait event</option>{lead.events?.map(({ event }) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label>}<label className="crm-field full">Catatan hasil <b>*</b><textarea name="note" maxLength={2000} required placeholder="Apa hasil percakapannya?" /></label></div><div className="crm-actions"><button className="crm-btn" disabled={busy}>Simpan tindak lanjut</button></div></form>}
      <div className="crm-timeline">{lead.followUps?.map((item) => <div className="crm-timeline-item" key={item.id}><strong>{label(CRM_STATUSES, item.status)}</strong><p>{item.note}</p><small>{item.actorName} · {dateText(item.createdAt)}{item.event ? ` · ${item.event.name}` : ''}{item.nextFollowUp ? ` · Hubungi lagi ${dateText(item.nextFollowUp)}` : ''}</small></div>)}{!lead.followUps?.length && <p className="crm-muted crm-small">Belum ada tindak lanjut yang dicatat.</p>}</div>
    </section>
    <section className="crm-card"><div className="crm-card-head"><div><span className="crm-eyebrow">Riwayat</span><h2>Reservasi & event</h2></div></div><div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Treatment</th><th>Jadwal</th><th>Status</th><th>Pembayaran</th></tr></thead><tbody>{lead.reservations?.map((item) => <tr key={item.reservationId}><td>{item.reservation.treatment.name}</td><td>{dateText(item.reservation.reservationDate)} · {item.reservation.reservationTime}</td><td>{item.visitResult === 'NO_SHOW' ? 'Tidak hadir' : item.reservation.status}</td><td>{item.reservation.status === 'completed' ? money(item.reservation.finalPrice) : '—'}</td></tr>)}{!lead.reservations?.length && <tr><td className="crm-empty" colSpan={4}>Belum ada reservasi dari kontak ini.</td></tr>}</tbody></table></div>{lead.reservations?.map((booking) => Boolean(booking.history?.length) && <details key={booking.reservationId} className="crm-small" style={{ marginTop: 14 }}><summary>Riwayat perubahan · {booking.reservation.treatment.name}</summary><div className="crm-timeline">{booking.history?.map((item) => <div key={item.id} className="crm-timeline-item"><strong>{({CREATED:'Reservasi dibuat',CONFIRMED:'Dikonfirmasi',COMPLETED:'Selesai',CANCELLED:'Dibatalkan',NO_SHOW:'Tidak hadir'} as Record<string,string>)[item.action] || item.action}</strong><p className="crm-muted">{item.actorName} · {dateText(item.createdAt)}</p></div>)}</div></details>)}{Boolean(lead.events?.length) && <p className="crm-muted crm-small" style={{ marginTop: 14 }}>Event yang pernah diikuti: {lead.events?.map(({ event }) => event.name).join(' · ')}</p>}</section>
    {canBook && lead.reservations?.filter((item) => item.reservation.status === 'completed' && item.visitResult === 'PENDING').map((item) => <form key={item.reservationId} className="crm-card" onSubmit={(event) => void recordResult(event,item.reservationId)}><CardResultTitle name={item.reservation.treatment.name} /><div className="crm-filters"><label className="crm-field">Hasil kunjungan <b>*</b><select name="visitResult" required defaultValue=""><option value="">Pilih hasil</option><option value="CONSULTATION">Konsultasi saja</option><option value="TREATMENT">Treatment</option></select></label><button className="crm-btn primary" disabled={busy}>Simpan hasil</button></div></form>)}
  </>;
}

function CardResultTitle({ name }: { name: string }) { return <div className="crm-card-head"><div><span className="crm-eyebrow">Perlu dilengkapi</span><h2>Hasil kunjungan · {name}</h2><p className="crm-muted crm-small">Reservasi sudah diselesaikan di Front Office.</p></div></div>; }
