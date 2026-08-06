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

  const recipientNameLines = wrapLines(data.customerName, 30).slice(0, 2);
  const addressLines = wrapLines(fullAddress, 42).slice(0, 5);

  const productLines: string[] = [];
  for (const item of data.items.slice(0, 6)) {
    const parts = [item.name];
    if (item.size) parts.push(item.size);
    parts.push(`x${item.quantity}`);
    productLines.push(escapeXml(parts.join(' ')));
  }
  if (data.items.length > 6) {
    productLines.push(`+ ${data.items.length - 6} produk lainnya`);
  }

  const notesLines: string[] = data.notes
    ? wrapLines(data.notes, 55).slice(0, 2)
    : [];

  const recipientNameStartY = 382;
  const recipientPhoneY = recipientNameStartY + recipientNameLines.length * 58 + 8;
  const addressStartY = recipientPhoneY + 56;
  const recipientEndY = addressStartY + addressLines.length * 44 + 28;
  const invoiceY = recipientEndY + 56;
  const paidAtY = invoiceY + 45;
  const orderDividerY = paidAtY + 31;
  const productsTitleY = orderDividerY + 50;
  const productsStartY = productsTitleY + 46;
  const productsEndY = productsStartY + productLines.length * 42 + 20;
  const notesDividerY = productsEndY + 8;
  const notesTitleY = notesDividerY + 38;
  const notesStartY = notesTitleY + 38;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <style>
    .sans { font-family: "DejaVu Sans", sans-serif; }
    .mono { font-family: "DejaVu Sans Mono", monospace; }
  </style>
  <rect width="${w}" height="${h}" fill="#fff"/>
  <rect x="24" y="24" width="${w - 48}" height="${h - 48}" fill="none" stroke="#111" stroke-width="4" rx="12"/>

  <text class="sans" x="${w / 2}" y="78" text-anchor="middle" font-size="28" font-weight="700" fill="#444">PENGIRIM</text>
  <text class="sans" x="${w / 2}" y="128" text-anchor="middle" font-size="44" font-weight="700" fill="#111">${escapeXml(SENDER.name)}</text>
  <text class="sans" x="${w / 2}" y="170" text-anchor="middle" font-size="30" fill="#333">${escapeXml(SENDER.phone)}</text>
  <text class="sans" x="${w / 2}" y="210" text-anchor="middle" font-size="28" fill="#555">${escapeXml(SENDER.address)}</text>
  <text class="sans" x="${w / 2}" y="246" text-anchor="middle" font-size="28" fill="#555">${escapeXml(SENDER.city)}</text>

  <line x1="70" y1="276" x2="${w - 70}" y2="276" stroke="#bbb" stroke-width="3"/>

  <text class="sans" x="${w / 2}" y="322" text-anchor="middle" font-size="32" font-weight="700" fill="#444">PENERIMA</text>
  ${recipientNameLines
    .map(
      (line, i) =>
        `<text class="sans" x="${w / 2}" y="${recipientNameStartY + i * 58}" text-anchor="middle" font-size="54" font-weight="700" fill="#111">${escapeXml(line)}</text>`,
    )
    .join('\n  ')}
  <text class="sans" x="${w / 2}" y="${recipientPhoneY}" text-anchor="middle" font-size="36" fill="#333">${escapeXml(data.customerPhone)}</text>
  ${addressLines
    .map(
      (line, i) =>
        `<text class="sans" x="${w / 2}" y="${addressStartY + i * 44}" text-anchor="middle" font-size="${
          addressLines.length > 3 ? 32 : 36
        }" fill="#111">${escapeXml(line)}</text>`,
    )
    .join('\n  ')}

  <line x1="70" y1="${recipientEndY}" x2="${w - 70}" y2="${recipientEndY}" stroke="#bbb" stroke-width="3"/>

  <text class="mono" x="70" y="${invoiceY}" font-size="40" font-weight="700" fill="#111"># ${escapeXml(data.invoiceNumber)}</text>
  <text class="sans" x="70" y="${paidAtY}" font-size="27" fill="#555">Dibayar: ${escapeXml(data.paidAt)} WIB</text>

  <line x1="70" y1="${orderDividerY}" x2="${w - 70}" y2="${orderDividerY}" stroke="#bbb" stroke-width="3"/>

  <text class="sans" x="70" y="${productsTitleY}" font-size="30" font-weight="700" fill="#444">ISI PAKET</text>
  ${productLines
    .map(
      (line, i) =>
        `<text class="sans" x="70" y="${productsStartY + i * 42}" font-size="29" fill="#111">${line}</text>`,
    )
    .join('\n  ')}

  ${notesLines.length > 0
    ? `<line x1="70" y1="${notesDividerY}" x2="${w - 70}" y2="${notesDividerY}" stroke="#bbb" stroke-width="3"/>
  <text class="sans" x="70" y="${notesTitleY}" font-size="25" font-weight="700" fill="#666">CATATAN</text>
  ${notesLines
    .map(
      (line, i) =>
        `<text class="sans" x="70" y="${notesStartY + i * 36}" font-size="27" fill="#333">${escapeXml(line)}</text>`,
    )
    .join('\n  ')}`
    : ''}

  <rect x="70" y="${h - 220}" width="${w - 140}" height="96" rx="10" fill="#111"/>
  <text class="sans" x="${w / 2}" y="${h - 156}" text-anchor="middle" font-size="48" font-weight="700" fill="#fff" letter-spacing="4">LUNAS - NON-COD</text>

  <text class="sans" x="${w / 2}" y="${h - 70}" text-anchor="middle" font-size="22" fill="#777">Label alamat - bukan bukti pembayaran | ${escapeXml(data.generatedAt)} WIB</text>
</svg>`;
}

export async function renderShippingLabelPng(data: ShippingLabelData): Promise<Buffer> {
  const svg = buildLabelSvg(data);
  return sharp(Buffer.from(svg)).png().withMetadata({ density: 300 }).toBuffer();
}

export async function renderShippingLabelJpg(data: ShippingLabelData): Promise<Buffer> {
  const svg = buildLabelSvg(data);
  return sharp(Buffer.from(svg)).jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).withMetadata({ density: 300 }).toBuffer();
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
