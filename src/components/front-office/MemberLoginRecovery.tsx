'use client';

import { useState } from 'react';

export default function MemberLoginRecovery({ memberId }: { memberId: string }) {
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/front-office/members/${memberId}/login-phone`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Permintaan gagal.');
      setFailed(false); setMessage(data.message); setPhone(''); setReason('');
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : 'Permintaan gagal.'); }
    finally { setBusy(false); }
  }

  return (
    <details className="mb-6 rounded-lg border p-4 text-gray-900">
      <summary className="cursor-pointer font-semibold">Aktivasi / pemulihan login WhatsApp</summary>
      <p className="my-3 text-sm text-gray-600">Gunakan setelah identitas member dicocokkan oleh Front Office. Sesi login lama akan dinonaktifkan. Member harus memverifikasi OTP pada nomor yang disetujui dalam 24 jam.</p>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">Nomor WhatsApp yang sudah dikonfirmasi<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={40} required className="mt-1 w-full rounded-lg border p-3" placeholder="0812…" /></label>
        <label className="block text-sm">Catatan verifikasi identitas<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={500} required className="mt-1 w-full rounded-lg border p-3" placeholder="Catat pemeriksaan identitas dan alasan perubahan nomor." /></label>
        {message && <p role="status" className={`rounded-lg p-3 text-sm ${failed ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}>{message}</p>}
        <button disabled={busy} className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-black disabled:opacity-50">{busy ? 'Memproses…' : 'Izinkan OTP nomor ini'}</button>
      </form>
    </details>
  );
}
