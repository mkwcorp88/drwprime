/**
 * Topic picker for the DRW Prime auto-blog.
 *
 * Order of preference:
 *   1. A curated hub-and-spoke queue (highest SEO value, written by hand).
 *   2. DataForSEO keyword ideas, when there is budget.
 *   3. A generative cross-product of the keyword cluster and treatment categories.
 *   4. A dated fallback, so the job never blocks on "nothing left to write".
 *
 * Every candidate is deduped against titles/slugs already in Payload.
 */
import { catalogCategories } from '@/lib/treatment-catalog';
import { getPayloadClient } from '@/lib/payload';
import { KEYWORD_CLUSTER } from './facts';
import { hasBudget, keywordIdeas } from './dataforseo';

export type Topic = {
  topic: string;
  keyword: string;
  source: 'cluster' | 'dataforseo' | 'generated' | 'fallback';
};

/** Pillar + spoke topics, highest search value first. Mirrors docs/SEO_AUTOMATION.md. */
const CLUSTER_QUEUE: Array<Omit<Topic, 'source'>> = [
  {
    topic: 'Panduan Lengkap Memilih Klinik Kecantikan di Jogja: Layanan, Harga, dan Cara Booking',
    keyword: 'klinik kecantikan jogja',
  },
  {
    topic: 'Harga Facial di Jogja Terbaru: Rincian Paket Facial Basic dan Prime',
    keyword: 'harga facial jogja',
  },
  {
    topic: 'Chemical Peeling di Jogja: Manfaat, Jenis, dan Siapa yang Cocok Menjalaninya',
    keyword: 'chemical peeling jogja',
  },
  {
    topic: 'Pico Laser di Jogja untuk Flek dan Bekas Jerawat: Cara Kerja dan Persiapannya',
    keyword: 'pico laser jogja',
  },
  {
    topic: 'HIFU Ultraformer MPT: Solusi Pengencangan Wajah Tanpa Operasi di Jogja',
    keyword: 'hifu jogja',
  },
  {
    topic: 'Skin Booster di Jogja: Kapan Kulit Anda Benar-Benar Membutuhkannya?',
    keyword: 'skin booster jogja',
  },
  {
    topic: 'Botox di Jogja: Area yang Bisa Ditangani, Durasi Hasil, dan Hal yang Perlu Diketahui',
    keyword: 'botox jogja',
  },
  {
    topic: 'Dermapen EPN untuk Tekstur Kulit: Apa Bedanya dengan Microneedling Biasa?',
    keyword: 'dermapen jogja',
  },
  {
    topic: 'IPL untuk Kulit Kusam dan Kemerahan: Panduan Singkat Sebelum Treatment Pertama',
    keyword: 'ipl jogja',
  },
  {
    topic: 'Urutan Perawatan Wajah di Klinik untuk Pemula: Mulai dari Mana?',
    keyword: 'perawatan wajah jogja',
  },
  {
    topic: 'Perawatan Rambut dan Kulit Kepala di Klinik: Pilihan untuk Rambut Rontok dan Ketombe',
    keyword: 'perawatan rambut jogja',
  },
  {
    topic: 'Body Spa dan Massage di Jogja: Manfaat Nyata untuk Pemulihan Tubuh',
    keyword: 'body spa jogja',
  },
];

/** Angle templates for the generative fallback. */
const ANGLES: Array<(keyword: string, category: string) => Omit<Topic, 'source'>> = [
  (keyword, category) => ({
    topic: `${category} di DRW Prime: Pilihan Treatment, Harga, dan Cara Memilihnya`,
    keyword,
  }),
  (keyword, category) => ({
    topic: `Apa yang Perlu Disiapkan Sebelum Menjalani ${category}?`,
    keyword,
  }),
  (keyword, category) => ({
    topic: `${category} untuk Pemula: Ekspektasi Realistis dan Perawatan Setelahnya`,
    keyword,
  }),
];

/** Titles + slugs already published or drafted, lowercased for dedup. */
async function usedKeys(limit = 200): Promise<Set<string>> {
  const used = new Set<string>();
  try {
    const payload = await getPayloadClient();
    const { docs } = await payload.find({
      collection: 'posts',
      limit,
      depth: 0,
      sort: '-createdAt',
      pagination: false,
    });
    for (const doc of docs as Array<{ title?: string; slug?: string }>) {
      if (doc.title) used.add(doc.title.toLowerCase());
      if (doc.slug) used.add(doc.slug.toLowerCase());
    }
  } catch (error) {
    console.error('[seo-engine] gagal baca post lama untuk dedup:', error);
  }
  return used;
}

function isFresh(candidate: Omit<Topic, 'source'>, used: Set<string>): boolean {
  return (
    !used.has(candidate.topic.toLowerCase()) && !used.has((candidate.keyword || '').toLowerCase())
  );
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function pickTopic(): Promise<Topic> {
  const used = await usedKeys();

  // 1) Curated queue first.
  for (const candidate of CLUSTER_QUEUE) {
    if (isFresh(candidate, used)) return { ...candidate, source: 'cluster' };
  }

  // 2) DataForSEO expansion — only when there is budget.
  if (await hasBudget()) {
    const ideas = await keywordIdeas(KEYWORD_CLUSTER.primary, { limit: 25 });
    for (const idea of ideas) {
      const candidate = {
        topic: `${titleCase(idea.keyword)}: Panduan Lengkap dari DRW Prime`,
        keyword: idea.keyword,
      };
      if (isFresh(candidate, used)) return { ...candidate, source: 'dataforseo' };
    }
  }

  // 3) Generative fallback: keyword cluster x treatment categories x angles.
  const keywords = [KEYWORD_CLUSTER.primary, ...KEYWORD_CLUSTER.secondary];
  const categories = catalogCategories.map((category) => category.name);
  for (const angle of ANGLES) {
    for (const keyword of keywords) {
      for (const category of categories) {
        const candidate = angle(keyword, category);
        if (isFresh(candidate, used)) return { ...candidate, source: 'generated' };
      }
    }
  }

  // 4) Last resort — never blocks the job.
  return {
    topic: `Rangkuman Perawatan Kecantikan di DRW Prime (${new Date().toISOString().slice(0, 10)})`,
    keyword: KEYWORD_CLUSTER.primary,
    source: 'fallback',
  };
}
