// Sampul blog lewat Aiera Studio, model Flare (Marketing Studio 2.5), 1k medium 16:9.
// Kuncinya sama dengan kunci teks. Dibayar dari dompet Studio milik kunci itu; saldo
// kosong (402) atau gagal apa pun mengembalikan null, dan pemanggil memakai model lama.
// Modul yang sama dipasang di tiap mesin blog; sumbernya repo r2media-otomatisasi (modul/flare.ts).

const BATAS_TUNGGU_MS = 150_000;

const alamat = (): string => (process.env.AIERA_STUDIO_URL || 'https://api.ai-era.id/v1/studio').replace(/\/+$/, '');

interface Keluaran {
  status?: string;
  generations?: { outputs?: { url?: string; mime?: string }[] }[];
  id?: string;
  error?: { message?: string };
}

/** `acuan` = tautan https foto yang bentuknya harus diikuti. */
export async function gambarFlare(
  kunci: string | undefined,
  prompt: string,
  acuan: string[] = [],
): Promise<{ data: Buffer; mime: string } | null> {
  // Kunci Google tidak dikenal Studio, jadi tidak perlu dicoba.
  if (!kunci || !kunci.startsWith('sk-')) return null;
  const kepala = { Authorization: `Bearer ${kunci}`, 'Content-Type': 'application/json' };
  try {
    const awal = await fetch(`${alamat()}/images`, {
      method: 'POST',
      headers: { ...kepala, 'Idempotency-Key': `blog-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` },
      body: JSON.stringify({
        model: 'ms-flare',
        prompt,
        aspect: '16:9',
        resolution: '1k',
        quality: 'medium',
        n: 1,
        wait: 60,
        ...(acuan.length ? { references: acuan } : {}),
      }),
      signal: AbortSignal.timeout(90_000),
    });
    let hasil = (await awal.json()) as Keluaran;
    if (!awal.ok) {
      console.warn(`[flare] ${awal.status}: ${String(hasil.error?.message || '').slice(0, 120)}`);
      return null;
    }
    const akhir = Date.now() + BATAS_TUNGGU_MS;
    while (hasil.status === 'processing' && hasil.id && Date.now() < akhir) {
      await new Promise((r) => setTimeout(r, 5000));
      const cek = await fetch(`${alamat()}/requests/${hasil.id}`, { headers: kepala, signal: AbortSignal.timeout(20_000) });
      if (cek.ok) hasil = (await cek.json()) as Keluaran;
    }
    const keluaran = hasil.generations?.[0]?.outputs?.[0];
    if (hasil.status !== 'completed' || !keluaran?.url) {
      console.warn(`[flare] tidak selesai: ${hasil.status}`);
      return null;
    }
    const berkas = await fetch(keluaran.url, { signal: AbortSignal.timeout(60_000) });
    if (!berkas.ok) throw new Error(`unduh ${berkas.status}`);
    const mime = (berkas.headers.get('content-type') || keluaran.mime || 'image/png').split(';')[0];
    return { data: Buffer.from(await berkas.arrayBuffer()), mime };
  } catch (e) {
    console.warn('[flare] gagal:', e instanceof Error ? e.message : e);
    return null;
  }
}
