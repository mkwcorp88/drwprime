'use client';

import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, Loader2 } from 'lucide-react';

const CARD_W = 1000;
const CARD_H = 1500;

const INK = '#3A2C17';
const GOLD = '#C9A24B';
const ROLE_GOLD = '#A97B2E';
const IVORY = '#FBF7EF';

const BG_URL = '/id-card-brand.jpg';
const LOGO_URL = '/drwprime-logo.png';

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
  while (result.length > 1 && ctx.measureText(`${result}...`).width > maxWidth) result = result.slice(0, -1);
  return `${result}...`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number, focusY = 0.5) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const cropY = Math.max(0, drawHeight - height);
  ctx.drawImage(image, x + (width - drawWidth) / 2, y - cropY * focusY, drawWidth, drawHeight);
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function archPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  const radius = width / 2;
  const bottom = y + height;
  ctx.beginPath();
  ctx.moveTo(x, bottom);
  ctx.lineTo(x, y + radius);
  ctx.arc(x + radius, y + radius, radius, Math.PI, 0, false);
  ctx.lineTo(x + width, bottom);
  ctx.closePath();
}

function drawFallbackBrand(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null) {
  const gradient = ctx.createLinearGradient(0, 0, 0, CARD_H);
  gradient.addColorStop(0, '#F8F1E5');
  gradient.addColorStop(1, '#E9D7B7');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 4;
  ctx.strokeRect(34, 34, CARD_W - 68, CARD_H - 68);

  if (logo) {
    const logoWidth = 620;
    const logoHeight = logoWidth * (277 / 1095);
    ctx.drawImage(logo, (CARD_W - logoWidth) / 2, 100, logoWidth, logoHeight);
  } else {
    ctx.fillStyle = ROLE_GOLD;
    ctx.font = '700 58px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.fillText('DRW PRIME', CARD_W / 2, 180);
  }
}

function drawIdCard(
  ctx: CanvasRenderingContext2D,
  { name, roleLabel, avatar }: {
    name: string;
    roleLabel: string;
    avatar: HTMLImageElement | null;
  },
  qrCanvas: HTMLCanvasElement | null,
  bg: HTMLImageElement | null,
  logo: HTMLImageElement | null,
) {
  if (bg) {
    ctx.drawImage(bg, 0, 0, CARD_W, CARD_H);
  } else {
    drawFallbackBrand(ctx, logo);
  }

  // The generated template has a large empty arch reserved for the staff portrait.
  const photoBox = { x: 246, y: 247, width: 508, height: 464 };
  ctx.save();
  archPath(ctx, photoBox.x, photoBox.y, photoBox.width, photoBox.height);
  ctx.clip();
  if (avatar) {
    drawCover(ctx, avatar, photoBox.x, photoBox.y, photoBox.width, photoBox.height, 0.38);
  } else {
    ctx.fillStyle = IVORY;
    ctx.fillRect(photoBox.x, photoBox.y, photoBox.width, photoBox.height);
    ctx.fillStyle = GOLD;
    ctx.font = '700 112px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.fillText(initials(name), CARD_W / 2, photoBox.y + photoBox.height / 2 + 38);
  }
  ctx.restore();

  // Keep a clean inner hairline around the live photo.
  archPath(ctx, photoBox.x, photoBox.y, photoBox.width, photoBox.height);
  ctx.strokeStyle = 'rgba(201,162,75,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // The generated artwork reserves exactly two rows: name and role.
  const infoX = 310;
  const infoWidth = 470;
  roundRectPath(ctx, 300, 735, 510, 160, 12);
  ctx.fillStyle = '#F7EFDF';
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.font = '700 28px Arial, Helvetica, sans-serif';
  const nameText = truncate(ctx, name, infoWidth);
  ctx.fillStyle = INK;
  ctx.fillText(nameText, infoX + 10, 800);

  ctx.fillStyle = ROLE_GOLD;
  ctx.font = '600 20px Arial, Helvetica, sans-serif';
  const roleText = truncate(ctx, roleLabel, infoWidth);
  ctx.fillText(roleText, infoX + 10, 874);

  // The template reserves the bottom white tile for the actual verification QR.
  const chip = { x: 360, y: 1195, size: 280, radius: 32 };
  roundRectPath(ctx, chip.x, chip.y, chip.size, chip.size, chip.radius);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.stroke();
  if (qrCanvas) ctx.drawImage(qrCanvas, chip.x + 14, chip.y + 14, chip.size - 28, chip.size - 28);
}

export default function StaffIdCard({ badgeValue, name, roleLabel, employeeId, avatarUrl }: CardData) {
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
          avatar = await loadImage(avatarUrl);
        } catch {
          avatar = null;
        }
      }
      const [bg, logo] = await Promise.all([
        loadImage(BG_URL).catch(() => null),
        loadImage(LOGO_URL).catch(() => null),
      ]);
      const canvas = document.createElement('canvas');
      canvas.width = CARD_W;
      canvas.height = CARD_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas tidak tersedia di browser ini.');
      drawIdCard(ctx, { name, roleLabel, avatar }, qrRef.current, bg, logo);
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
      <div className="relative w-[300px] overflow-hidden rounded-3xl bg-[#F3EADB] shadow-2xl ring-1 ring-[#C9A24B]/60">
        <img src={BG_URL} alt="" className="absolute inset-0 h-full w-full object-cover" />

        <div className="relative aspect-[2/3] w-full">
          <div className="absolute left-[24.6%] top-[16.5%] z-20 h-[31%] w-[50.8%] overflow-hidden rounded-[999px_999px_0_0] bg-[#FBF7EF] ring-1 ring-[#C9A24B]/80">
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center font-serif text-5xl font-bold text-[#C9A24B]">{initials(name)}</span>
            )}
          </div>

          <div className="absolute left-[30%] top-[48.8%] z-20 h-[11.2%] w-[51%] rounded-r-[12px] bg-[#F7EFDF]" />

          <div className="absolute left-[32%] top-[51.5%] z-30 w-[47%] overflow-hidden">
            <p className="truncate font-sans text-[11px] font-bold leading-[1.35] text-[#3A2C17]">{name}</p>
            <p className="mt-2 truncate text-[8px] font-semibold leading-[1.35] text-[#A97B2E]">{roleLabel}</p>
          </div>

          <div className="absolute left-[36%] top-[79.67%] z-40 aspect-square w-[28%] rounded-[12px] bg-white p-[1.4%] shadow-md ring-1 ring-[#C9A24B]">
            <QRCodeCanvas ref={qrRef} value={badgeValue} size={170} level="H" style={{ width: '100%', height: '100%', display: 'block' }} />
          </div>
        </div>
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
