'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Html5Qrcode } from 'html5-qrcode';
import { Camera, Loader2, ScanLine, X } from 'lucide-react';

type Props = {
  title: string;
  subtitle?: string;
  onToken: (token: string) => void;
  onClose: () => void;
  busy?: boolean;
};

export default function BadgeScannerModal({ title, subtitle, onToken, onClose, busy }: Props) {
  const [manual, setManual] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startRef = useRef<Promise<null> | null>(null);
  const claimedRef = useRef(false);

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    const start = startRef.current;
    if (!scanner) return;
    scannerRef.current = null;
    try {
      await start;
      if (scanner.isScanning) await scanner.stop();
    } catch {
      /* start() may reject before a stream exists */
    } finally {
      if (!scanner.isScanning) {
        try { scanner.clear(); } catch { /* already cleared */ }
      }
      if (startRef.current === start) startRef.current = null;
      setScanning(false);
    }
  }, []);

  useEffect(() => () => { void stopCamera(); }, [stopCamera]);

  const handleToken = useCallback(async (raw: string) => {
    if (claimedRef.current) return;
    const token = raw.trim();
    if (!token) return;
    claimedRef.current = true;
    await stopCamera();
    onToken(token);
  }, [stopCamera, onToken]);

  const startCamera = async () => {
    setCameraError('');
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('ops-qr-reader', {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      });
      scannerRef.current = scanner;
      const start = scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decoded) => void handleToken(decoded),
        () => { /* no code per frame is normal */ },
      );
      startRef.current = start;
      await start;
      setScanning(true);
    } catch (error) {
      console.error('[SCAN] camera start failed:', error);
      setCameraError('Kamera tidak dapat diakses. Gunakan input manual di bawah atau berikan izin kamera.');
      scannerRef.current = null;
    }
  };

  const submitManual = () => {
    if (manual.trim()) void handleToken(manual);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="fo-glass-modal w-full max-w-md rounded-t-[2rem] p-6 sm:rounded-[2rem]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Scan Kartu Terapis</p>
            <h2 className="font-playfair mt-1 text-xl font-bold">{title}</h2>
            {subtitle && <p className="mt-1 text-xs text-white/50">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-full bg-white/10 p-2"><X className="size-5" /></button>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
          <div id="ops-qr-reader" className="min-h-[220px] w-full" />
        </div>

        <div className="mt-4 flex flex-col items-center gap-2">
          {scanning ? (
            <span className="flex items-center gap-2 text-xs font-semibold text-primary"><Loader2 className="size-4 animate-spin" /> Arahkan QR kartu terapis ke kamera...</span>
          ) : (
            <button onClick={() => void startCamera()} className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-xs font-bold text-black transition hover:bg-primary-light">
              <Camera className="size-4" /> Nyalakan Kamera
            </button>
          )}
          {cameraError && <p className="text-center text-xs text-red-300">{cameraError}</p>}
        </div>

        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="mb-2 text-[11px] font-semibold text-white/50">Fallback manual — tempel token QR</p>
          <div className="flex gap-2">
            <input
              value={manual}
              onChange={(event) => setManual(event.target.value)}
              placeholder="DRW-STAFF:..."
              className="h-11 min-w-0 flex-1 rounded-xl bg-black/30 px-3 text-sm text-white outline-none ring-1 ring-white/20 placeholder:text-white/25 focus:ring-primary/60"
            />
            <button onClick={submitManual} disabled={busy} className="flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-black transition hover:bg-primary-light disabled:opacity-50">
              <ScanLine className="size-4" /> {busy ? 'Proses...' : 'Kirim'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
