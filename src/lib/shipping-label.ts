import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

const WIDTH_PX = 1200;
const HEIGHT_PX = 1800;

const SENDER = {
  name: 'DRW Prime Yogyakarta',
  address: 'Jl. Affandi No. 123',
  city: 'Sleman, Yogyakarta 55281',
  phone: '+62 811-3880-0071',
};

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) { current = word; continue; }
    if ((current + ' ' + word).length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current += ' ' + word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

export interface ShippingLabelData {
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingProvince: string;
  shippingPostal: string | null;
  items: { name: string; size: string | null; quantity: number }[];
  notes: string | null;
  paidAt: string;
  generatedAt: string;
}

function buildLabelSvg(data: ShippingLabelData): string {
  const w = WIDTH_PX;
  const h = HEIGHT_PX;

  const fullAddress = [
    data.shippingAddress,
    data.shippingCity || '',
    data.shippingProvince || '',
    data.shippingPostal || '',
  ]
    .filter(Boolean)
    .join(', ');

  const addressLines = wrapLines(fullAddress, 48);

  const productLines: string[] = [];
  for (const item of data.items.slice(0, 6)) {
    const parts = [item.name];
    if (item.size) parts.push(item.size);
    parts.push(`×${item.quantity}`);
    productLines.push(escapeXml(parts.join(' ')));
  }
  if (data.items.length > 6) {
    productLines.push(`+ ${data.items.length - 6} produk lainnya`);
  }

  const notesLines: string[] = data.notes
    ? wrapLines(data.notes, 55).slice(0, 2)
    : [];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#fff"/>
  <rect x="16" y="16" width="${w - 32}" height="${h - 32}" fill="none" stroke="#111" stroke-width="3" rx="12"/>

  <text x="${w / 2}" y="72" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="700" fill="#444">PENGIRIM</text>
  <text x="${w / 2}" y="104" text-anchor="middle" font-family="sans-serif" font-size="26" font-weight="700" fill="#111">${escapeXml(SENDER.name)}</text>
  <text x="${w / 2}" y="132" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#333">${escapeXml(SENDER.phone)}</text>
  <text x="${w / 2}" y="156" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#555">${escapeXml(SENDER.address)}</text>
  <text x="${w / 2}" y="178" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#555">${escapeXml(SENDER.city)}</text>

  <line x1="80" y1="200" x2="${w - 80}" y2="200" stroke="#e5e5e5" stroke-width="2"/>

  <text x="${w / 2}" y="244" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="700" fill="#444">PENERIMA</text>
  <text x="${w / 2}" y="284" text-anchor="middle" font-family="sans-serif" font-size="30" font-weight="700" fill="#111">${escapeXml(data.customerName)}</text>
  <text x="${w / 2}" y="316" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#333">${escapeXml(data.customerPhone)}</text>
  ${addressLines
    .map(
      (line, i) =>
        `<text x="${w / 2}" y="${344 + i * 30}" text-anchor="middle" font-family="sans-serif" font-size="${
          addressLines.length > 3 ? 18 : 20
        }" fill="#111">${escapeXml(line)}</text>`,
    )
    .join('\n  ')}

  <line x1="80" y1="${addressLines.length > 4 ? 500 : 460}" x2="${w - 80}" y2="${addressLines.length > 4 ? 500 : 460}" stroke="#e5e5e5" stroke-width="2"/>

  <text x="80" y="${addressLines.length > 4 ? 540 : 500}" font-family="monospace" font-size="28" font-weight="700" fill="#111"># ${escapeXml(data.invoiceNumber)}</text>
  <text x="80" y="${addressLines.length > 4 ? 574 : 534}" font-family="sans-serif" font-size="16" fill="#555">Dibayar: ${escapeXml(data.paidAt)} WIB</text>

  <line x1="80" y1="${addressLines.length > 4 ? 598 : 558}" x2="${w - 80}" y2="${addressLines.length > 4 ? 598 : 558}" stroke="#e5e5e5" stroke-width="2"/>

  <text x="80" y="${addressLines.length > 4 ? 636 : 596}" font-family="sans-serif" font-size="18" font-weight="700" fill="#444">ISI PAKET</text>
  ${productLines
    .map(
      (line, i) =>
        `<text x="80" y="${(addressLines.length > 4 ? 670 : 630) + i * 28}" font-family="sans-serif" font-size="18" fill="#111">${line}</text>`,
    )
    .join('\n  ')}

  ${notesLines.length > 0
    ? `<line x1="80" y1="${(addressLines.length > 4 ? 850 : 810)}" x2="${w - 80}" y2="${(addressLines.length > 4 ? 850 : 810)}" stroke="#e5e5e5" stroke-width="2"/>
  <text x="80" y="${(addressLines.length > 4 ? 884 : 844)}" font-family="sans-serif" font-size="14" font-weight="700" fill="#888">CATATAN</text>
  ${notesLines
    .map(
      (line, i) =>
        `<text x="80" y="${(addressLines.length > 4 ? 912 : 872) + i * 22}" font-family="sans-serif" font-size="16" fill="#333">${escapeXml(line)}</text>`,
    )
    .join('\n  ')}`
    : ''}

  <rect x="80" y="${h - 180}" width="${w - 160}" height="70" rx="10" fill="#111"/>
  <text x="${w / 2}" y="${h - 138}" text-anchor="middle" font-family="sans-serif" font-size="28" font-weight="900" fill="#fff" letter-spacing="6">LUNAS — NON-COD</text>

  <text x="${w / 2}" y="${h - 70}" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#aaa">Label alamat — bukan bukti pembayaran  |  ${escapeXml(data.generatedAt)} WIB</text>
</svg>`;
}

export async function renderShippingLabelPng(data: ShippingLabelData): Promise<Buffer> {
  const svg = buildLabelSvg(data);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function renderShippingLabelJpg(data: ShippingLabelData): Promise<Buffer> {
  const svg = buildLabelSvg(data);
  return sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toBuffer();
}

export async function renderShippingLabelPdf(data: ShippingLabelData): Promise<Buffer> {
  const [pngBuffer] = await Promise.all([
    renderShippingLabelPng(data),
  ]);

  const pdfDoc = await PDFDocument.create();
  const image = await pdfDoc.embedPng(pngBuffer);

  const mmToPt = (mm: number) => (mm / 25.4) * 72;
  const pageWidth = mmToPt(101.6);
  const pageHeight = mmToPt(152.4);

  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  const imgRatio = image.width / image.height;
  const pageRatio = pageWidth / pageHeight;

  let drawWidth: number;
  let drawHeight: number;
  if (imgRatio > pageRatio) {
    drawWidth = pageWidth;
    drawHeight = pageWidth / imgRatio;
  } else {
    drawHeight = pageHeight;
    drawWidth = pageHeight * imgRatio;
  }

  const x = (pageWidth - drawWidth) / 2;
  const y = (pageHeight - drawHeight) / 2;

  page.drawImage(image, { x, y, width: drawWidth, height: drawHeight });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

export async function renderShippingLabelsBatch(
  dataList: ShippingLabelData[],
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();

  const mmToPt = (mm: number) => (mm / 25.4) * 72;
  const pageWidth = mmToPt(101.6);
  const pageHeight = mmToPt(152.4);

  for (const data of dataList) {
    const pngBuffer = await renderShippingLabelPng(data);
    const image = await pdfDoc.embedPng(pngBuffer);

    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    const imgRatio = image.width / image.height;
    const pageRatio = pageWidth / pageHeight;

    let drawWidth: number;
    let drawHeight: number;
    if (imgRatio > pageRatio) {
      drawWidth = pageWidth;
      drawHeight = pageWidth / imgRatio;
    } else {
      drawHeight = pageHeight;
      drawWidth = pageHeight * imgRatio;
    }

    const x = (pageWidth - drawWidth) / 2;
    const y = (pageHeight - drawHeight) / 2;
    page.drawImage(image, { x, y, width: drawWidth, height: drawHeight });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
