// Gaya tulisan natural + pemeriksa fakta untuk blog otomatis.
// Modul yang sama dipasang di tiap mesin blog; sumbernya repo r2media-otomatisasi
// (modul/gaya-natural.ts) dan skill blog-natural. Prinsip gaya dari blader/humanizer (MIT).
//
// Gaya natural TIDAK boleh dipakai tanpa pemeriksa faktanya: diminta terdengar
// manusiawi, AI mengarang kebijakan dan spesifikasi (uji 25 Nov 2026).

export const GAYA_NATURAL = `GAYA (wajib, mengalahkan aturan gaya lain di atas bila bertentangan; aturan FORMAT dan struktur tetap berlaku):
- Tulis untuk satu pembaca yang sedang menghadapi masalah ini, seperti staf berpengalaman menjelaskan langsung kepadanya.
- Paragraf pertama langsung menjawab pertanyaan pembaca. JANGAN dibuka dengan definisi "X adalah/merupakan ...", "Mengetahui/Memilih ... sangat penting", sapaan, atau "Di era ...".
- Tiap paragraf membawa satu hal baru. Paragraf yang hanya mengulang dihapus.
- Fakta tentang perusahaan, produk, layanan, harga, kebijakan, jaminan, dan hasil HANYA dari DATA atau FAKTA. Yang tidak ada di sana: minta pembaca menanyakannya, jangan dijawab. JANGAN mengarang batasan, pengalaman, testimoni, kutipan, atau angka agar terdengar manusiawi.
- Cara kerja atau tahapan layanan yang tidak ada di data ditulis sebagai gambaran umum ("umumnya", "biasanya"), bukan seolah prosedur pasti di tempat ini.
- Satu sapaan sepanjang artikel. Jangan mencampur "kamu" dan "Anda".
- Pakai kata sehari-hari: "cocok" bukan "ideal bagi", "bisa" bukan "mampu", "supaya" bukan "guna".
- Panjang kalimat dan paragraf beragam.
- Daftar berpoin hanya untuk yang berurutan atau dibandingkan. JANGAN pola "Label tebal: penjelasan" di tiap poin. Tebal paling banyak tiga kali.
- DILARANG: tanda pisah panjang; "bukan hanya/sekadar ... tetapi"; "tidak hanya ... tetapi juga"; "solusi tepat/terbaik"; "pilihan tepat"; "jangan ragu"; "tunggu apa lagi"; "tak bisa dipungkiri"; "optimal" dan "maksimal" sebagai hiasan; subjudul "Kesimpulan" atau "Penutup".
- Jangan mengawali paragraf dengan "Selain itu", "Oleh karena itu", "Dengan demikian", atau "Tak hanya itu".
- Jangan memaksakan tiga serangkai ("aman, nyaman, dan menyenangkan").
- Merek disebut secukupnya. Ajakan menghubungi cukup satu kali, di akhir.`;

const hitung = (teks: string, pola: RegExp): number => (teks.match(pola) || []).length;
const polos = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** Masalah gaya pada HTML artikel. Kosong = lolos. */
export function periksaGaya(html: string): string[] {
  const paragraf = Array.from(html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)).map((m) => polos(m[1]));
  const teks = polos(html);
  const kata = teks.split(' ').length;
  const masalah: string[] = [];
  const tolak = (syarat: boolean, pesan: string): void => {
    if (syarat) masalah.push(pesan);
  };
  tolak(/[—–]/.test(teks), 'memakai tanda pisah panjang');
  tolak(/bukan (?:hanya|sekadar|cuma|saja)\b[^.]{0,90}\b(?:tetapi|melainkan|tapi|namun)|(?:tidak|tak) hanya\b[^.]{0,90}\bjuga\b/i.test(teks), 'pola "bukan hanya ... tetapi juga"');
  tolak(/^[^.]{3,70}?\b(?:adalah|merupakan)\b/i.test(paragraf[0] || ''), 'dibuka dengan definisi');
  tolak(/^(?:mengetahui|menentukan|memilih|memahami|merencanakan)\b[^.]*\b(?:penting|krusial|membingungkan)\b/i.test(paragraf[0] || ''), 'kalimat pembuka generik');
  tolak(/di era\b|dalam dunia yang|tak bisa dipungkiri|tidak dapat dipungkiri/i.test(teks), 'pembuka klise');
  tolak(/jangan ragu|tunggu apa lagi|solusi (?:yang )?(?:tepat|terbaik|ideal)|pilihan (?:yang )?(?:tepat|terbaik|ideal)/i.test(teks), 'bahasa iklan klise');
  tolak(/<h[23][^>]*>\s*(?:kesimpulan|penutup)/i.test(html), 'subjudul Kesimpulan atau Penutup');
  tolak((hitung(teks, /\b(?:optimal|maksimal)\b/gi) * 1000) / kata > 1.5, 'terlalu sering "optimal/maksimal"');
  tolak(hitung(html, /<(?:strong|b)>/g) > 5, 'terlalu banyak teks tebal');
  tolak(hitung(html, /<li[^>]*>\s*<(?:strong|b)>/g) > 2, 'poin berpola label tebal');
  tolak(paragraf.filter((p) => /^(?:selain itu|oleh karena itu|dengan demikian|tak hanya itu|tidak hanya itu)\b/i.test(p)).length > 1, 'paragraf berulang diawali kata penghubung');
  tolak(/\bkamu\b/i.test(teks) && /\bAnda\b/.test(teks), 'mencampur "kamu" dan "Anda"');
  return masalah;
}

/** "Rp125.000", "Rp 125 ribu", "Rp2,5 juta" menjadi angka. */
function nominal(teks: string): { tulis: string; nilai: number }[] {
  return Array.from(teks.matchAll(/Rp\.?\s*(\d[\d.,]*)(?:\s*(ribu|rb|juta|jt)\b)?/gi)).map((m) => {
    const satuan = (m[2] || '').toLowerCase();
    const angka = satuan
      ? Number(m[1].replace(/[.,]$/, '').replace(',', '.')) * (satuan === 'ribu' || satuan === 'rb' ? 1e3 : 1e6)
      : Number(m[1].replace(/[^\d]/g, ''));
    return { tulis: m[0].trim(), nilai: angka };
  });
}

export function hargaTanpaDasar(html: string, fakta: string): string[] {
  const boleh = new Set(nominal(fakta).map((n) => n.nilai));
  Array.from(fakta.matchAll(/\d{1,3}(?:[.,]\d{3})+|\d{5,}/g)).forEach((m) => boleh.add(Number(m[0].replace(/[^\d]/g, ''))));
  return nominal(polos(html)).filter((n) => !boleh.has(n.nilai)).map((n) => `harga ${n.tulis} tidak ada di data`);
}

const tautan = (html: string): string[] => Array.from(html.matchAll(/href="([^"]+)"/g)).map((m) => m[1]);

const PERIKSA_BAWAAN =
  'fakta tentang perusahaan, produk, layanan, fasilitas, kebijakan, biaya, yang termasuk atau tidak termasuk harga, jam, jaminan, hasil, sertifikasi, tenaga ahli, atau tahapan layanan di tempatnya (kecuali jelas disebut gambaran umum dengan "umumnya" atau "biasanya"); juga janji hasil, janji tanpa rasa sakit atau tanpa risiko, klaim menyembuhkan, dan angka statistik';

export interface Penghalus<T> {
  artikel: T;
  html: (a: T) => string;
  /** Prompt penulisan asli, supaya format keluarannya sama. */
  aturan: string;
  fakta: string;
  minta: (prompt: string) => Promise<unknown>;
  /** Pemeriksa milik mesin sendiri. */
  periksa?: (a: T) => string[];
  yangDiperiksa?: string;
}

/** Paling banyak dua suntingan. `klaim` yang tersisa berarti artikel TIDAK boleh langsung tayang. */
export async function haluskan<T>(o: Penghalus<T>): Promise<{ artikel: T; klaim: string[] }> {
  const cekKlaim = async (a: T): Promise<string[]> => {
    const jawab = (await o.minta(
      `PERIKSA KLAIM. Kutip dari ARTIKEL setiap kalimat yang menyatakan ${o.yangDiperiksa || PERIKSA_BAWAAN}, yang TIDAK tertulis di DATA dan tidak bisa disimpulkan langsung darinya. JANGAN kutip: pernyataan bahwa suatu informasi belum tercantum atau perlu ditanyakan, saran umum untuk pembaca, aturan keselamatan umum, pengetahuan umum yang lazim, ajakan bertanya, atau yang sesuai DATA. Bila tidak ada, kembalikan daftar kosong.\n\nBalas HANYA JSON: {"klaim": ["kalimat", ...]}\n\nDATA:\n${o.fakta}\n\nARTIKEL:\n${polos(o.html(a))}`,
    )) as { klaim?: unknown };
    // Jawaban rusak melempar: yang faktanya tak terperiksa tidak boleh tayang.
    if (!jawab || !Array.isArray(jawab.klaim)) throw new Error('pemeriksa fakta tidak menjawab');
    return hargaTanpaDasar(o.html(a), o.fakta).concat(jawab.klaim.map(String).filter(Boolean));
  };
  const mutu = (a: T): string[] => (o.periksa ? o.periksa(a) : []);

  let artikel = o.artikel;
  let klaim = await cekKlaim(artikel);
  for (let i = 0; i < 2; i++) {
    const gaya = periksaGaya(o.html(artikel));
    const rusak = mutu(artikel);
    // Suntingan kedua hanya untuk yang menggagalkan artikel, bukan sekadar gaya.
    if (!klaim.length && !rusak.length && (!gaya.length || i > 0)) break;
    try {
      const baru = (await o.minta(
        `Sunting ARTIKEL di bawah supaya terbaca ditulis manusia. Hapus, atau ubah jadi ajakan bertanya, setiap klaim tanpa dasar yang disebut. Fakta lain, angka, harga, nama, dan tautan tetap. Jangan menambah fakta atau tautan baru. Panjangnya kurang lebih tetap, kecuali MASALAH menyebut terlalu pendek: perpanjang dengan saran umum yang berguna, bukan fakta perusahaan.\n\nMASALAH: ${rusak.concat(klaim.map((k) => `klaim tanpa dasar: "${k}"`), gaya).join('; ')}.\n\nATURAN ASLI, format keluaran WAJIB sama persis:\n${o.aturan}\n\nARTIKEL:\n${JSON.stringify(artikel)}`,
      )) as T;
      const lama = new Set(tautan(o.html(artikel)));
      if (!o.html(baru) || tautan(o.html(baru)).some((t) => !lama.has(t))) continue;
      const klaimBaru = await cekKlaim(baru);
      const beda = [
        mutu(baru).length - rusak.length,
        klaimBaru.length - klaim.length,
        periksaGaya(o.html(baru)).length - gaya.length,
      ].find((n) => n !== 0);
      if (beda !== undefined && beda < 0) {
        artikel = baru;
        klaim = klaimBaru;
      }
    } catch (e) {
      // Suntingan gagal tidak membuang artikel yang sudah ada.
      console.error('[gaya] suntingan gagal:', e instanceof Error ? e.message : e);
    }
  }
  return { artikel, klaim };
}
