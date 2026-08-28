'use client';

import { useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { IdCard, QrCode } from 'lucide-react';

export default function StaffBadgeCard({
  name,
  employeeId,
  roleLabel,
}: {
  name: string;
  employeeId: string;
  roleLabel: string;
}) {
  const [badgeValue, setBadgeValue] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void fetch('/api/treatment-ops/me/badge', { cache: 'no-store' })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!active) return;
        if (response.status === 401) { window.location.href = '/treatment-ops/login'; return; }
        if (!response.ok) { setError(data.error || 'Kartu barcode belum tersedia.'); return; }
        setBadgeValue(data.badgeValue);
      })
      .catch(() => { if (active) setError('Barcode tidak dapat dimuat.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <div className="mx-auto max-w-md">
      <section className="fo-glass-card rounded-[2rem] p-7 text-center sm:p-10">
        <IdCard className="mx-auto size-10 text-primary" />
        <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.24em] text-primary">Barcode karyawan</p>
        <h1 className="font-playfair mt-2 text-3xl font-bold">{name}</h1>
        <p className="mt-1 text-sm text-white/50">{roleLabel} · {employeeId}</p>

        {loading && <p className="py-16 text-sm text-white/40">Memuat barcode...</p>}

        {!loading && badgeValue && (
          <>
            <div className="mx-auto mt-7 w-fit rounded-3xl bg-white p-4">
              <QRCodeCanvas value={badgeValue} size={224} level="H" />
            </div>
            <p className="mt-5 flex items-center justify-center gap-2 text-[11px] leading-5 text-white/45">
              <QrCode className="size-4 text-primary/70" />
              Tunjukkan barcode ini kepada Super Admin saat memulai atau menyelesaikan tindakan.
            </p>
          </>
        )}

        {!loading && !badgeValue && (
          <p className="mt-7 rounded-2xl bg-white/[0.04] p-4 text-sm leading-6 text-white/55 ring-1 ring-white/10">
            {error || 'Kartu barcode belum diterbitkan.'}
            <br />
            <span className="text-xs text-white/40">Minta Super Admin menerbitkan kartu dari halaman Kartu.</span>
          </p>
        )}
      </section>
    </div>
  );
}
