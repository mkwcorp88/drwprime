'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import type { Html5Qrcode } from 'html5-qrcode';

interface MemberInfo {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalSpending: number;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
}

const TIER_LABEL: Record<string, string> = {
  Bronze: '🥉 Bronze',
  Silver: '🥈 Silver',
  Gold: '🥇 Gold',
  Platinum: '💎 Platinum',
};

export default function SpendingScanPage() {

  const [scanning, setScanning] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [scannedToken, setScannedToken] = useState('');
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [amount, setAmount] = useState('');
  const [treatment, setTreatment] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const scannerRef = useRef<Html5Qrcode | null>(null);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);

  const stopScan = useCallback(async () => {
    const s = scannerRef.current;
    if (s) {
      try {
        await s.stop();
        await s.clear();
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => {
    return () => {
      stopScan();
    };
  }, [stopScan]);

  const lookupMember = useCallback(async (token: string) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/front-office/member-lookup?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mencari member');
      setMember(data.member);
      setScannedToken(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mencari member');
    } finally {
      setLoading(false);
    }
  }, []);

  const startScan = async () => {
    setError('');
    setSuccess('');
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      setScanning(true);
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decodedText) => {
          await stopScan();
          await lookupMember(decodedText.trim());
        },
        () => {
          // abaikan error per-frame
        }
      );
    } catch {
      setError('Tidak bisa mengakses kamera. Pastikan izin kamera diberikan, lalu coba lagi.');
      setScanning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError('Masukkan nominal spending yang valid.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/front-office/spending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: scannedToken, amount: amountNum, treatment, date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mencatat spending');
      setSuccess(
        `Spending ${formatCurrency(amountNum)} tercatat untuk ${member?.name} (+${data.pointsEarned} poin). Total: ${formatCurrency(data.totalSpending)} · ${TIER_LABEL[data.tier]}.`
      );
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mencatat spending');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setMember(null);
    setScannedToken('');
    setManualToken('');
    setAmount('');
    setTreatment('');
    setDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <div className="min-h-screen fo-glass-page fo-theme-dashboard">
      <div className="pt-20 pb-10">
          <div className="max-w-lg mx-auto px-4 py-6 fo-fade-up">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div>
                <h1 className="font-playfair text-2xl font-bold text-primary mb-1">Catat Spending (Scan)</h1>
                <p className="text-white/60 text-sm">Scan QR member untuk mencatat spending langsung ke akunnya.</p>
              </div>
              <Link href="/front-office" className="fo-nav-chip text-sm whitespace-nowrap">Kembali</Link>
            </div>

            {error && (
              <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">{error}</div>
            )}
            {success && (
              <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-300">{success}</div>
            )}

            {/* Scanner */}
            {!member && (
              <div className="fo-glass-card rounded-xl p-5 border-primary/35">
                <div id="qr-reader" className={`overflow-hidden rounded-lg mb-4 ${scanning ? '' : 'hidden'}`} />

                {!scanning ? (
                  <button
                    onClick={startScan}
                    className="w-full bg-primary text-dark font-bold py-3 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h.01M4 4h4v4H4V4zm12 0h4v4h-4V4zM4 16h4v4H4v-4z" />
                    </svg>
                    Mulai Scan QR
                  </button>
                ) : (
                  <button
                    onClick={stopScan}
                    className="w-full fo-glass-card-soft border-red-500/35 text-red-300 font-semibold py-2.5 rounded-lg hover:bg-red-500/20 transition-colors"
                  >
                    Hentikan Scan
                  </button>
                )}

                {/* Manual fallback */}
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-white/50 text-xs mb-2">Kamera bermasalah? Masukkan kode QR manual:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      placeholder="Tempel kode QR di sini"
                      className="flex-1 fo-glass-input rounded-lg px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => manualToken.trim() && lookupMember(manualToken.trim())}
                      disabled={loading || !manualToken.trim()}
                      className="bg-primary/20 border border-primary/30 text-primary px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                    >
                      Cari
                    </button>
                  </div>
                </div>
                {loading && <p className="text-white/50 text-xs mt-3">Mencari member...</p>}
              </div>
            )}

            {/* Member found → form */}
            {member && (
              <div className="space-y-4">
                <div className="fo-glass-card rounded-xl p-5 border-primary/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-bold text-lg">{member.name}</p>
                      <p className="text-white/50 text-xs">{member.email} · {member.phone}</p>
                    </div>
                    <span className="text-sm font-semibold text-primary whitespace-nowrap">{TIER_LABEL[member.tier]}</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                    <span className="text-white/60 text-xs">Total spending saat ini</span>
                    <span className="text-white font-semibold text-sm">{formatCurrency(member.totalSpending)}</span>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="fo-glass-card rounded-xl p-5 border-primary/35 space-y-4">
                  <div>
                    <label className="block text-white/70 text-sm mb-1.5">Nominal Spending (Rp) *</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Contoh: 350000"
                      className="w-full fo-glass-input rounded-lg px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-white/70 text-sm mb-1.5">Treatment / Keterangan</label>
                    <input
                      type="text"
                      value={treatment}
                      onChange={(e) => setTreatment(e.target.value)}
                      placeholder="Contoh: Acne Facial"
                      className="w-full fo-glass-input rounded-lg px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-white/70 text-sm mb-1.5">Tanggal</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full fo-glass-input rounded-lg px-3 py-2.5 text-sm [color-scheme:dark]"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="flex-1 fo-glass-card-soft border-white/15 text-white/70 font-semibold py-2.5 rounded-lg hover:bg-white/10 transition-colors text-sm"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 bg-primary text-dark font-bold py-2.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 text-sm"
                    >
                      {submitting ? 'Menyimpan...' : 'Catat Spending'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
