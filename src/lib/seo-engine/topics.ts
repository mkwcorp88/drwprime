/**
 * Topic picker for the DRW Prime auto-blog.
 *
 * Walks a curated hub-and-spoke queue, written by hand and highest SEO value
 * first, skipping anything already covered by a post in Payload. An empty queue
 * returns null and the job stops: publishing a filler article every day is worse
 * than publishing nothing.
 */
import { getPayloadClient } from '@/lib/payload';
import { isTopicCovered } from './topic-dedup';

export type Topic = {
  topic: string;
  keyword: string;
  source: 'cluster';
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

/**
 * Titles + slugs already published or drafted. Errors propagate on purpose: an
 * empty result would make every queue entry look unwritten.
 */
async function usedKeys(limit = 1000): Promise<string[]> {
  const payload = await getPayloadClient();
  const { docs } = await payload.find({
    collection: 'posts',
    limit,
    depth: 0,
    sort: '-createdAt',
    pagination: false,
    select: { title: true, slug: true },
  });
  const used: string[] = [];
  for (const doc of docs as Array<{ title?: string; slug?: string }>) {
    if (doc.title) used.push(doc.title);
    if (doc.slug) used.push(doc.slug);
  }
  return used;
}

export async function pickTopic(): Promise<Topic | null> {
  const used = await usedKeys();

  for (const candidate of CLUSTER_QUEUE) {
    if (!isTopicCovered(candidate, used)) return { ...candidate, source: 'cluster' };
  }
  return null;
}
