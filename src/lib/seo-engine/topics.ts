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
  // Volumes measured 6 Nov 2026 (keyword_overview, Indonesia). Every entry is on the menu.
  {
    topic: 'Nail Art di Jogja: Pilihan Nail Treatment dan Cara Merawat Kuku Sesudahnya',
    keyword: 'nail art jogja', // 880/bln
  },
  {
    topic: 'Cauter di Klinik: Cara Kerja, Persiapan, dan Perawatan Kulit Setelahnya',
    keyword: 'cauter wajah', // 590/bln
  },
  {
    topic: 'Manicure Pedicure di Jogja: Apa Saja yang Dikerjakan dan Berapa Sering Perlu Dilakukan',
    keyword: 'manicure pedicure jogja', // 110/bln
  },
  {
    topic: 'Eyelash Extension di Jogja: Cara Memilih Model dan Merawat Bulu Mata Sambungan',
    keyword: 'eyelash extension jogja', // 70/bln
  },
  // Wave 2, measured 25 Nov 2026. Infus, suntik, dan klaim pengobatan sengaja tidak ada.
  {
    topic: 'Nail Gel atau Nail Polish Biasa: Daya Tahan dan Cara Merawatnya',
    keyword: 'nail gel', // 2900/bln
  },
  {
    topic: 'Botox Rahang: Tujuan, Durasi Hasil, dan Pertanyaan untuk Dokter',
    keyword: 'botox rahang', // 1900/bln
  },
  {
    topic: 'Perawatan Kuku Rapuh: Kebiasaan Harian dan Layanan di Klinik',
    keyword: 'perawatan kuku', // 480/bln
  },
  {
    topic: 'HIFU untuk Double Chin: Siapa yang Cocok dan Hasil yang Realistis',
    keyword: 'hifu double chin', // 390/bln
  },
  {
    topic: 'Paket Slimming Treatment: Yang Dikerjakan dan Perannya di Samping Pola Makan',
    keyword: 'slimming treatment', // 390/bln
  },
  {
    topic: 'Eyelash Extension Tahan Berapa Lama dan Kapan Perlu Retouch',
    keyword: 'eyelash extension tahan berapa lama', // 320/bln
  },
  {
    topic: 'Efek Samping Pico Laser yang Wajar dan Tanda Perlu Kontrol',
    keyword: 'efek samping pico laser', // 260/bln
  },
  {
    topic: 'Botox Dahi: Area, Durasi, dan Persiapan Sebelum Tindakan',
    keyword: 'botox dahi', // 210/bln
  },
  {
    topic: 'Efek Samping HIFU: Yang Umum Dirasakan dan Cara Menyikapinya',
    keyword: 'efek samping hifu', // 110/bln
  },
  {
    topic: 'Jadwal Perawatan Sebelum Menikah: Urutan dan Jarak Antar Treatment',
    keyword: 'perawatan sebelum menikah', // 110/bln
  },
  {
    topic: 'Dermapen EPN untuk Bopeng: Berapa Sesi dan Apa yang Bisa Diharapkan',
    keyword: 'dermapen untuk bopeng', // 90/bln
  },
  {
    topic: 'Chemical Peeling untuk Bopeng: Batas Kemampuannya dan Alternatifnya',
    keyword: 'chemical peeling untuk bopeng', // 70/bln
  },
  {
    topic: 'HIFU atau Botox: Perbedaan Cara Kerja dan Cara Memilihnya',
    keyword: 'hifu vs botox', // 20/bln
  },
  {
    topic: 'Perawatan Setelah Dermapen: Tujuh Hari Pertama',
    keyword: 'perawatan setelah dermapen', // 20/bln
  },
  {
    topic: 'Perawatan Setelah Pico Laser agar Kulit Pulih dengan Baik',
    keyword: 'perawatan setelah pico laser', // 10/bln
  },
  {
    topic: 'Perawatan Setelah Chemical Peeling: Yang Dihindari dan Dianjurkan',
    keyword: 'perawatan setelah chemical peeling', // 10/bln
  },
  {
    topic: 'IPL Hair Removal di Jogja: Persiapan dan Jarak Antar Sesi',
    keyword: 'ipl hair removal jogja', // 10/bln
  },
  {
    topic: 'Skin Booster atau Botox: Tujuan yang Berbeda, Jangan Tertukar',
    keyword: 'skin booster vs botox', // 10/bln
  },
  {
    topic: 'Pico Laser atau IPL: Mana untuk Masalah Pigmen Anda',
    keyword: 'pico laser vs ipl',
  },
  {
    topic: 'Facial atau Chemical Peeling: Kapan Memilih yang Mana',
    keyword: 'facial vs chemical peeling',
  },
  {
    topic: 'Hand Spa di Jogja: Tahapan dan Manfaat untuk Tangan Kering',
    keyword: 'hand spa jogja',
  },
  {
    topic: 'Anti Dandruff Treatment: Tahapan Perawatan Kulit Kepala di Klinik',
    keyword: 'perawatan ketombe di klinik',
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
