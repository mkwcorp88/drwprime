'use client';

import { useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

export default function MemberQrCard() {
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/member-qr');
        if (!res.ok) return;
        const data = await res.json();
        if (active) {
          setToken(data.qrToken);
          setName(data.name);
        }
      } catch {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading || !token) return null;

  return (
    <section className="mobile-surface mb-5 overflow-hidden rounded-[24px] border-primary/35">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[84px] w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.04]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/15">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h.01M4 4h4v4H4V4zm12 0h4v4h-4V4zM4 16h4v4H4v-4z" />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">QR Member Saya</p>
            <p className="mt-1 text-xs leading-5 text-white/50">Tunjukkan ke Front Office untuk mencatat spending</p>
          </div>
        </div>
        <svg
          className={`h-5 w-5 flex-shrink-0 text-primary/60 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-white/10 px-5 pb-6 pt-5 text-center">
          <div className="mx-auto w-fit rounded-2xl bg-white p-3 shadow-[0_12px_28px_rgba(0,0,0,0.24)]">
            <QRCodeCanvas value={token} size={180} level="M" />
          </div>
          <p className="mt-4 text-sm font-semibold text-white">{name}</p>
          <p className="mt-1 text-xs text-white/40">Kode unik untuk membership DRW Prime Anda</p>
        </div>
      )}
    </section>
  );
}
