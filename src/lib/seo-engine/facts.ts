/**
 * Grounding facts for the SEO engine.
 *
 * Everything the article generator is allowed to state about treatments and
 * prices comes from here, and here alone. The source is the same catalog the
 * public site renders (`src/lib/treatment-catalog.ts`), NOT the raw
 * `src/data/drw-menu-source.json` — the raw file still carries `[cite: NNN]`
 * artefacts that `cleanText()` strips on the way into `catalogCategories`.
 */
import { catalogCategories, clinicInfo } from '@/lib/treatment-catalog';
import { SITE_URL, SITE_NAME } from '@/lib/seo';

export const COMPANY = {
  name: SITE_NAME,
  legalName: clinicInfo.name || 'DRW Primé by dr. Wahyu Triasmara',
  site: SITE_URL,
  address: clinicInfo.address,
  contact: clinicInfo.contact,
  city: 'Yogyakarta',
  region: 'Sleman, Daerah Istimewa Yogyakarta',
} as const;

/**
 * Real DRW Prime interior photos on the live site — used to ground the AI cover.
 * The `.webp` variants are deliberate: the `.png` originals are ~1.6 MB each,
 * which base64-inlines into a >2 MB Gemini request. The webp equivalents are
 * 20-70 KB with no visible quality loss at reference-image size.
 */
export const SOURCE_PHOTOS = [
  '/drwprime-facial-room.webp',
  '/drwprime-facial-room-2.webp',
  '/drwprime-laser-room.webp',
  '/drwprime-consultation-room.webp',
  '/drwprime-contouring-room.webp',
  '/drwprime-loungue.webp',
  '/drwprime-resepsionis-2.webp',
  '/drwprime-faceside.webp',
] as const;

function formatPrice(value: number): string {
  if (!value) return 'hubungi klinik';
  return `Rp${value.toLocaleString('id-ID')}`;
}

/**
 * The DATA block handed to Gemini. Only treatments that carry a real price are
 * listed, so the model can never quote a number the catalog does not have.
 */
export function factSheet({ maxPerCategory = 8 }: { maxPerCategory?: number } = {}): string {
  const lines: string[] = [];

  lines.push(`KLINIK: ${COMPANY.legalName}`);
  lines.push(`ALAMAT: ${COMPANY.address}`);
  lines.push(`KONTAK: ${COMPANY.contact}`);
  lines.push(`WEBSITE: ${COMPANY.site}`);
  lines.push('');
  lines.push('DAFTAR TREATMENT & HARGA RESMI (satu-satunya sumber harga yang boleh dikutip):');

  for (const category of catalogCategories) {
    const priced = category.treatments.filter((treatment) => treatment.price > 0);
    if (priced.length === 0) continue;

    lines.push('');
    lines.push(`## ${category.name}`);
    for (const treatment of priced.slice(0, maxPerCategory)) {
      const description = treatment.description ? ` — ${treatment.description}` : '';
      lines.push(
        `- ${treatment.name}: ${formatPrice(treatment.price)} (${COMPANY.site}/treatments/${treatment.slug})${description}`
      );
    }
    if (priced.length > maxPerCategory) {
      lines.push(`- (+${priced.length - maxPerCategory} treatment lain di kategori ini)`);
    }
  }

  return lines.join('\n');
}

/** Flat treatment list — used by the audit to sanity-check article claims. */
export function allTreatmentNames(): string[] {
  return catalogCategories.flatMap((category) =>
    category.treatments.map((treatment) => treatment.name)
  );
}

/**
 * Seed keywords for the DRW Prime cluster. Deliberately local-intent: the clinic
 * is a single physical location in Sleman/Yogyakarta, so national head terms are
 * not worth chasing.
 */
export const KEYWORD_CLUSTER = {
  primary: 'klinik kecantikan jogja',
  secondary: [
    'facial jogja',
    'botox jogja',
    'pico laser jogja',
    'hifu jogja',
    'chemical peeling jogja',
    'skin booster jogja',
    'dermapen jogja',
    'perawatan wajah jogja',
  ],
} as const;
