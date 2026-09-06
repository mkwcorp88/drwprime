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
const BUILDING_URL = '/drwprime-building.jpg';
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
  building: HTMLImageElement | null,
  logo: HTMLImageElement | null,
) {
  if (bg) {
    ctx.drawImage(bg, 0, 0, CARD_W, CARD_H);
  } else {
    drawFallbackBrand(ctx, logo);
  }

  // Remove the generated building area before adding the real DRW Prime photo.
  ctx.fillStyle = '#F5ECDB';
  ctx.fillRect(0, 1094, CARD_W, CARD_H - 1094);

  const buildingBox = { x: 43, y: 1106, width: 914, height: 342, radius: 26 };
  if (building) {
    ctx.save();
    roundRectPath(ctx, buildingBox.x, buildingBox.y, buildingBox.width, buildingBox.height, buildingBox.radius);
    ctx.clip();
    drawCover(ctx, building, buildingBox.x, buildingBox.y, buildingBox.width, buildingBox.height, 0.18);
    ctx.restore();
    roundRectPath(ctx, buildingBox.x, buildingBox.y, buildingBox.width, buildingBox.height, buildingBox.radius);
    ctx.strokeStyle = 'rgba(255,255,255,0.78)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(201,162,75,0.82)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(40, 1094);
  ctx.lineTo(40, 1462);
  ctx.moveTo(960, 1094);
  ctx.lineTo(960, 1462);
  ctx.moveTo(40, 1462);
  ctx.lineTo(400, 1462);
  ctx.moveTo(600, 1462);
  ctx.lineTo(960, 1462);
  ctx.stroke();

  // The generated template has a large empty arch reserved for the staff portrait.
  const photoBox = { x: 270, y: 405, width: 460, height: 470 };
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

  // The information panel in the generated artwork provides three usable rows.
  const infoX = 304;
  const infoWidth = 500;
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = '700 29px Arial, Helvetica, sans-serif';
  ctx.fillText(truncate(ctx, name, infoWidth), infoX, 948);

  ctx.fillStyle = ROLE_GOLD;
  ctx.font = '600 21px Arial, Helvetica, sans-serif';
  ctx.fillText(truncate(ctx, roleLabel, infoWidth), infoX, 997);

  // The template reserves the bottom white tile for the actual verification QR.
  const chip = { x: 390, y: 1258, size: 220, radius: 28 };
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
      const [bg, building, logo] = await Promise.all([
        loadImage(BG_URL).catch(() => null),
        loadImage(BUILDING_URL).catch(() => null),
        loadImage(LOGO_URL).catch(() => null),
      ]);
      const canvas = document.createElement('canvas');
      canvas.width = CARD_W;
      canvas.height = CARD_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas tidak tersedia di browser ini.');
      drawIdCard(ctx, { name, roleLabel, avatar }, qrRef.current, bg, building, logo);
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
          <div className="absolute inset-x-0 top-[72.9%] bottom-0 z-10 bg-[#F5ECDB]" />

          <div className="absolute left-[4.3%] top-[73.7%] z-20 h-[22.8%] w-[91.4%] overflow-hidden rounded-[18px] ring-1 ring-white/70">
            <img src={BUILDING_URL} alt="Gedung DRW Prime" className="h-full w-full object-cover object-[center_18%]" />
          </div>

          <div className="absolute left-[27%] top-[27%] z-20 h-[31.3%] w-[46%] overflow-hidden rounded-[999px_999px_0_0] bg-[#FBF7EF] ring-1 ring-[#C9A24B]/80">
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center font-serif text-5xl font-bold text-[#C9A24B]">{initials(name)}</span>
            )}
          </div>

          <div className="absolute left-[29.5%] top-[61.9%] z-20 w-[50.5%] overflow-hidden">
            <p className="truncate font-sans text-[11px] font-bold leading-[1.35] text-[#3A2C17]">{name}</p>
            <p className="truncate text-[8px] font-semibold leading-[1.8] text-[#A97B2E]">{roleLabel}</p>
          </div>

          <div className="absolute left-[39%] top-[83.87%] z-30 aspect-square w-[22%] rounded-[10px] bg-white p-[1.4%] shadow-md ring-1 ring-[#C9A24B]">
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
