'use client';

import { useEffect, useState } from 'react';
import { IdCard } from 'lucide-react';
import StaffIdCard from '@/components/treatment-ops/StaffIdCard';
import { roleLabels } from '@/lib/treatment-operations/constants';

type MeBadge = {
  badgeValue: string;
  issuedAt: string;
  name: string;
  employeeId: string;
  role: string;
  branchName: string | null;
  avatarUrl: string | null;
};

export default function StaffBadgeCard() {
  const [badge, setBadge] = useState<MeBadge | null>(null);
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
        setBadge(data);
      })
      .catch(() => { if (active) setError('Barcode tidak dapat dimuat.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <div className="mx-auto max-w-md">
      <section className="mobile-surface rounded-[28px] p-5 text-center sm:p-8">
        <IdCard className="mx-auto size-9 text-primary" />
        <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.24em] text-primary">Barcode karyawan</p>
        <h1 className="font-playfair mt-1 text-2xl font-bold">{badge?.name ?? 'Barcode karyawan'}</h1>
        {!badge && <p className="mt-1 text-xs text-white/45">Kartu ID pribadi untuk scan oleh Super Admin.</p>}

        {loading && <p className="py-16 text-sm text-white/40">Memuat barcode...</p>}

        {!loading && badge && (
          <div className="mt-6">
            <StaffIdCard
              badgeValue={badge.badgeValue}
              name={badge.name}
              roleLabel={(roleLabels as Record<string, string>)[badge.role] ?? badge.role}
              employeeId={badge.employeeId}
              branchName={badge.branchName}
              avatarUrl={badge.avatarUrl}
            />
            <p className="mt-3 text-[11px] leading-5 text-white/40">
              Tunjukkan kartu ini kepada Super Admin saat memulai atau menyelesaikan tindakan. Unduh PNG untuk mencetak sendiri.
            </p>
          </div>
        )}

        {!loading && !badge && (
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
