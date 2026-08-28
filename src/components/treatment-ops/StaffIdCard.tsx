'use client';

import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, Loader2 } from 'lucide-react';

const CARD_W = 1011;
const CARD_H = 638;
const GOLD = '#D4AF37';

type CardData = {
  badgeValue: string;
  name: string;
  roleLabel: string;
  employeeId: string;
  branchName: string | null;
  avatarUrl: string | null;
};

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) result = result.slice(0, -1);
  return `${result}…`;
}

function drawIdCard(
  ctx: CanvasRenderingContext2D,
  { name, roleLabel, employeeId, branchName, avatar }: { name: string; roleLabel: string; employeeId: string; branchName: string | null; avatar: HTMLImageElement | null },
  qrCanvas: HTMLCanvasElement | null,
) {
  const c = CARD_W / 2;

  const gradient = ctx.createLinearGradient(0, 0, 0, CARD_H);
  gradient.addColorStop(0, '#14110b');
  gradient.addColorStop(1, '#251b0b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const glow = ctx.createRadialGradient(c, 120, 10, c, 120, 420);
  glow.addColorStop(0, 'rgba(212,175,55,0.16)');
  glow.addColorStop(1, 'rgba(212,175,55,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 6;
  ctx.strokeRect(16, 16, CARD_W - 32, CARD_H - 32);
  ctx.strokeStyle = 'rgba(212,175,55,0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(27, 27, CARD_W - 54, CARD_H - 54);

  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD;
  ctx.font = '700 56px Arial, Helvetica, sans-serif';
  ctx.fillText('DRW PRIME', c, 84);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '600 17px Arial, Helvetica, sans-serif';
  ctx.fillText('T R E A T M E N T   O P E R A T I O N S', c, 118);

  ctx.strokeStyle = 'rgba(212,175,55,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(c - 150, 134);
  ctx.lineTo(c + 150, 134);
  ctx.stroke();

  const cx = c;
  const cy = 200;
  const r = 60;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
  ctx.fillStyle = GOLD;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#000';
  ctx.fill();
  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  } else {
    ctx.fillStyle = GOLD;
    ctx.font = '700 48px Arial, Helvetica, sans-serif';
    ctx.fillText(initials(name), cx, cy + 17);
  }

  ctx.font = '700 42px Arial, Helvetica, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(truncate(ctx, name, CARD_W - 170), cx, 300);

  ctx.font = '600 26px Arial, Helvetica, sans-serif';
  ctx.fillStyle = GOLD;
  ctx.fillText(roleLabel, cx, 338);

  ctx.font = '500 20px Arial, Helvetica, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  ctx.fillText(`${employeeId}${branchName ? `  ·  ${branchName}` : ''}`, cx, 372);

  const qSize = 176;
  const qx = cx - qSize / 2;
  const qy = 394;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(qx, qy, qSize, qSize);
  ctx.shadowBlur = 0;
  if (qrCanvas) ctx.drawImage(qrCanvas, qx, qy, qSize, qSize);

  ctx.font = '500 16px Arial, Helvetica, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('Scan by Super Admin only', c, 598);
}

export default function StaffIdCard({ badgeValue, name, roleLabel, employeeId, branchName, avatarUrl }: CardData) {
  const qrRef = useRef<HTMLCanvasElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const download = async () => {
    setBusy(true);
    setError('');
    try {
      let avatar: HTMLImageElement | null = null;
      if (avatarUrl) {
        try {
          avatar = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = avatarUrl;
          });
        } catch {
          avatar = null;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = CARD_W;
      canvas.height = CARD_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas tidak tersedia di browser ini.');
      drawIdCard(ctx, { name, roleLabel, employeeId, branchName, avatar }, qrRef.current);
      const link = document.createElement('a');
      link.download = `ID-CARD-${employeeId || 'staff'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Gagal membuat ID card.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-[312px] overflow-hidden rounded-2xl bg-gradient-to-b from-[#14110b] to-[#251b0b] p-3 text-center shadow-2xl ring-1 ring-[#D4AF37]/80">
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-[#D4AF37]/30 ring-inset" />
        <p className="mt-1 text-2xl font-bold tracking-wide text-[#D4AF37]">DRW PRIME</p>
        <p className="text-[9px] font-semibold tracking-[0.28em] text-white/50">TREATMENT OPERATIONS</p>
        <div className="mx-auto mt-1.5 h-px w-24 bg-[#D4AF37]/80" />

        <div className="mt-3 flex justify-center">
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="size-[72px] rounded-full object-cover ring-2 ring-[#D4AF37]" />
          ) : (
            <span className="flex size-[72px] items-center justify-center rounded-full bg-black text-2xl font-bold text-[#D4AF37] ring-2 ring-[#D4AF37]">{initials(name)}</span>
          )}
        </div>
        <p className="mt-2 truncate px-2 text-lg font-bold text-white">{name}</p>
        <p className="text-sm font-semibold text-[#D4AF37]">{roleLabel}</p>
        <p className="text-[11px] text-white/60">{employeeId}{branchName ? ` · ${branchName}` : ''}</p>

        <div className="mx-auto mt-2 w-fit rounded-lg bg-white p-2">
          <QRCodeCanvas ref={qrRef} value={badgeValue} size={170} level="H" style={{ width: 128, height: 128, display: 'block' }} />
        </div>
        <p className="mt-2 pb-1 text-[9px] tracking-wide text-white/50">Scan by Super Admin only</p>
      </div>

      <button
        onClick={() => void download()}
        disabled={busy}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-xs font-bold text-black transition hover:bg-primary-light disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        {busy ? 'Membuat ID card...' : 'Download ID Card (PNG)'}
      </button>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
