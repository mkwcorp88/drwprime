import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import {
  renderShippingLabelJpg,
  renderShippingLabelPdf,
  renderShippingLabelsBatch,
  type ShippingLabelData,
} from '@/lib/shipping-label';

const labelData: ShippingLabelData = {
  invoiceNumber: 'INV-DRWP-20260806-TEST01',
  customerName: 'Siti Rahayu & Keluarga',
  customerPhone: '0812-3456-7890',
  shippingAddress: 'Jl. Contoh Panjang No. 123, RT 04/RW 08, dekat Pasar <Utama>',
  shippingCity: 'Kabupaten Sleman',
  shippingProvince: 'Daerah Istimewa Yogyakarta',
  shippingPostal: '55281',
  items: [
    { name: 'Specialized Acne Control Cleanser', size: '100 ml', quantity: 2 },
    { name: 'Lumiera Brightening Moisturizer', size: '30 g', quantity: 1 },
  ],
  notes: 'Hubungi penerima sebelum paket diantar.',
  paidAt: '06 Agu 2026 14.15',
  generatedAt: '06 Agu 2026 14.20',
};

describe('Shipping label rendering', () => {
  it('renders a 1200x1800 JPEG at 300 DPI', async () => {
    const jpg = await renderShippingLabelJpg(labelData);
    const metadata = await sharp(jpg).metadata();

    expect(metadata.format).toBe('jpeg');
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(1800);
    expect(metadata.density).toBe(300);
    expect(jpg.byteLength).toBeGreaterThan(10_000);
  });

  it('renders one exact 100x150 mm PDF page', async () => {
    const bytes = await renderShippingLabelPdf(labelData);
    const pdf = await PDFDocument.load(bytes);
    const [page] = pdf.getPages();

    expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.getPageCount()).toBe(1);
    expect(page.getWidth()).toBeCloseTo(288, 1);
    expect(page.getHeight()).toBeCloseTo(432, 1);
  });

  it('renders one page per order in a batch PDF', async () => {
    const bytes = await renderShippingLabelsBatch([
      labelData,
      { ...labelData, invoiceNumber: 'INV-DRWP-20260806-TEST02' },
    ]);
    const pdf = await PDFDocument.load(bytes);

    expect(pdf.getPageCount()).toBe(2);
  });
});
