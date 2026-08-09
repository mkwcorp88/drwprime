# SEO Automation — DRW Prime

Perintah lengkap untuk **cek SEO** dan **otomatisasi konten** drwprime.com.

Dokumen ini menggantikan empat sumber yang sebelumnya terpencar di repo drwskincare
(`docs/GEO_AUTOMATION_SCHEDULE.md`, `content/products/geo-monitor/README.md`,
`docs/CONTENT_CLUSTERS.md`, `docs/GEO_FASE4_RAG.md` §7.1) dan prompt produksi yang
hanya hidup di `scripts/geo/lib/article.mjs`.

---

## 1. Ringkasan

Dua job berjalan di **Cronicle .159** (`cronicle.mkwiro.online`), keduanya cuma `curl`
ke endpoint di app drwprime — karena Cronicle dan container drwprime ada di box yang
sama (`network_mode: host`).

| Job | Jadwal (WIB) | Endpoint | Fungsi |
|---|---|---|---|
| `DRW Prime — Blog Automation` | tiap jam, menit 0 | `POST /api/cron/seo-blog` | tulis + terbitkan artikel |
| `DRW Prime — SEO Audit (harian)` | 08:00 | `POST /api/cron/seo-audit` | cek kesehatan SEO + ranking |

```
Cronicle .159 ──curl──▶ drwprime :5054 ──┬─▶ DataForSEO  (SERP rank, keyword ideas, on-page)
                                          ├─▶ Gemini      (teks JSON + cover 16:9)
                                          ├─▶ Payload CMS (media → MinIO, posts → published)
                                          └─▶ Prisma SeoAuditRun + Telegram
```

**Kenapa endpoint, bukan skrip terpisah** (seperti drwtrans/dzawanikost):
konten drwprime disimpan sebagai Lexical JSON milik Payload, bukan HTML — jadi
penulisannya harus lewat Payload. Container app sudah punya kredensial MinIO,
`DATABASE_URI`, dan Payload Local API. Pola curl-ke-endpoint ini juga sudah dipakai
job lain di Cronicle yang sama (BeautyCenter, Detawa).

---

## 2. Cek SEO (job audit)

`src/app/api/cron/seo-audit/route.ts`. Yang diperiksa tiap hari:

1. **Ketersediaan halaman kunci** — `/`, `/treatments`, `/products`, `/blog`.
   Untuk tiap halaman: status HTTP, ada `<title>`, ada meta description, ada
   canonical, ada `og:image`, dan **apakah ter-`noindex`**.
2. **Sitemap** — `/sitemap.xml` bisa diambil dan berapa `<loc>` di dalamnya.
3. **robots.txt** — bisa diambil, dan tidak memblokir `/blog`.
4. **Kesegaran konten** — jumlah artikel published dan umur artikel terbaru.
5. **Ranking Google Indonesia** (DataForSEO, kalau ada saldo) — posisi organik
   untuk keyword cluster, beserta perubahan vs run sebelumnya.
6. **On-page instant audit** (DataForSEO) — skor on-page, waktu muat, dan daftar
   check yang gagal.

Hasil → tabel `seo_audit_runs` (Prisma) + digest Telegram + halaman `/admin/seo`.

### Skor kesehatan
Mulai dari 100, dikurangi: halaman non-200 (−15), `noindex` tak disengaja (−15),
robots memblokir `/blog` (−15), sitemap gagal (−10), artikel terbaru >14 hari (−8),
tanpa title (−5), tanpa description (−4), tanpa canonical (−3), tanpa og:image (−2).
`ok = true` bila skor ≥80 **dan** semua halaman kunci 200.

### Catatan DataForSEO
`checks` dari DataForSEO mayoritas **negative-framed** (`true` = ada masalah), tapi
ada belasan key yang sebaliknya (`is_https`, `canonical`, `seo_friendly_url*`, dst).
Daftar pengecualian ada di `POSITIVE_CHECKS` (`src/lib/seo-engine/dataforseo.ts`) dan
sudah diverifikasi terhadap respons asli untuk drwprime.com — jangan dihapus, kalau
tidak `is_https` akan dilaporkan sebagai kegagalan.

---

## 3. Otomatisasi konten (job blog)

`src/app/api/cron/seo-blog/route.ts`.

```
pickTopic() ──▶ generateArticle() ──▶ generateCover() ──▶ upload media ──▶ create post
```

1. **Idempoten per hari.** Job menghitung artikel yang sudah dibuat hari ini dan
   hanya menulis kekurangannya terhadap `BLOG_ARTICLES_PER_DAY` (default 1).
   Karena itu ia aman dipanggil **tiap jam** — dan memang harus tiap jam, lihat §7.
2. **Pemilihan topik** (`src/lib/seo-engine/topics.ts`), berurutan:
   curated cluster queue → ekspansi DataForSEO `keyword_ideas` → fallback generatif
   (keyword × kategori treatment × angle) → fallback bertanggal. Semua kandidat
   didedup terhadap judul/slug artikel yang sudah ada di Payload.
3. **Penulisan** — Gemini dengan `responseSchema`, di-ground pada blok DATA.
4. **Cover** — Gemini image-to-image dari foto ruangan klinik asli, 16:9.
5. **Publish** — media → MinIO lewat Payload, lalu post `_status: published`.
   Hook `afterChange` yang sudah ada me-revalidate `/blog`, `/blog/[slug]`, `/sitemap.xml`.

Gagal bikin cover **tidak** menggagalkan artikel — post tetap terbit tanpa heroImage.

### Sumber fakta (anti-halusinasi)
`src/lib/seo-engine/facts.ts` membangun blok DATA dari `catalogCategories` +
`clinicInfo` (`src/lib/treatment-catalog.ts`) — 16 kategori, 136 treatment beserta
harga resmi. **Jangan** ganti sumbernya ke `src/data/drw-menu-source.json` mentah:
file itu masih mengandung artefak `[cite: NNN]` yang baru dibersihkan `cleanText()`
di dalam treatment-catalog.

### Prompt produksi
Ada di `const SYSTEM`, `src/lib/seo-engine/gemini.ts`. Inti aturannya:

- Hanya boleh memakai fakta dari blok DATA — dilarang mengarang treatment, harga,
  durasi, promo, atau fasilitas.
- **Dilarang klaim medis**, diagnosis, atau janji hasil ("pasti hilang", "permanen",
  "sembuh total"). Wajib bahasa berhati-hati: "membantu", "umumnya", "hasil bervariasi".
- Keputusan medis selalu diarahkan ke konsultasi dokter di klinik.
- 700-1000 kata, keyword di judul + paragraf pertama + 1-2 subjudul.
- Anti-pola-AI: variasikan panjang kalimat, hindari pembuka klise dan "Selain itu,"
  berulang. (Diambil dari `PROMPT_UPDATE_NATURAL_WRITING.md` milik drwskincare, yang
  sudah dihapus dari repo — masih bisa diambil lewat
  `git show 760293dc:PROMPT_UPDATE_NATURAL_WRITING.md`.)
- Output blok terstruktur (`h2`/`h3`/`p`/`ul`), bukan HTML.

### Prompt gambar
`coverPrompt()` di file yang sama. Grounding pada foto ruangan asli agar cover tidak
menampilkan klinik fiktif. Larangan eksplisit: tanpa teks/logo/watermark overlay,
**tanpa wajah orang yang bisa dikenali, tanpa adegan tindakan medis, tanpa jarum,
darah, atau perbandingan before/after**.

### Kenapa blok, bukan HTML
Payload menyimpan rich text sebagai Lexical JSON. Helper resmi
`convertHTMLToLexical` butuh JSDOM (bukan dependency di sini, dan berat untuk cron),
jadi generator mengeluarkan daftar blok dan `src/lib/seo-engine/lexical.ts` memetakannya
ke bentuk node Lexical yang persis sama dengan yang ditulis Payload sendiri.
Hasilnya `<h2>`/`<h3>`/`<ul>` sungguhan — bukan paragraf tebal seperti artikel lama.

---

## 4. Cluster keyword

Klinik ini satu lokasi fisik di Sleman/Yogyakarta, jadi target keyword sengaja
**local-intent** — head term nasional tidak sepadan untuk dikejar.

- **Primary:** `klinik kecantikan jogja`
- **Secondary:** `facial jogja`, `botox jogja`, `pico laser jogja`, `hifu jogja`,
  `chemical peeling jogja`, `skin booster jogja`, `dermapen jogja`, `perawatan wajah jogja`

Queue pillar + spoke ada di `CLUSTER_QUEUE` (`src/lib/seo-engine/topics.ts`).
Aturan: **satu keyword = satu artikel** (hindari kanibalisasi), dan tiap artikel
menyebut minimal satu treatment DRW Prime beserta harga dari DATA.

---

## 5. Environment

Di server: `/opt/git/drwprime.env` (dibaca `deploy-drwprime.sh` saat `docker run`).

| Variabel | Wajib | Keterangan |
|---|---|---|
| `CRON_SECRET` | ya | Bearer untuk kedua endpoint. Kalau kosong, endpoint menolak jalan (500) |
| `GEMINI_API_KEY` | untuk blog | Teks + gambar. Audit tetap jalan tanpa ini |
| `DATAFORSEO_AUTH` | opsional | base64 `login:password`. Tanpa ini ranking/on-page dilewati |
| `TELEGRAM_BOT_TOKEN` | opsional | Notifikasi |
| `TELEGRAM_CHAT_ID` | opsional | Notifikasi |
| `BLOG_ARTICLES_PER_DAY` | opsional | Default `1` |
| `GEO_GEN_GEMINI_MODEL` | opsional | Default `gemini-2.5-flash` |
| `GEO_IMAGE_GEMINI_MODEL` | opsional | Default `gemini-2.5-flash-image` |

Semuanya runtime-only (bukan build-arg) — cukup redeploy agar container membacanya.

---

## 6. Menjalankan manual

```bash
# di server .159
S=$(grep -m1 '^CRON_SECRET=' /opt/git/drwprime.env | cut -d= -f2-)

# audit
curl -fsS -H "Authorization: Bearer $S" http://127.0.0.1:5054/api/cron/seo-audit | jq

# artikel — DRAFT dulu (aman, tidak publik)
curl -fsS -H "Authorization: Bearer $S" "http://127.0.0.1:5054/api/cron/seo-blog?force=1&draft=1" | jq

# artikel — terbit beneran
curl -fsS -H "Authorization: Bearer $S" "http://127.0.0.1:5054/api/cron/seo-blog?force=1" | jq
```

Pakai `?draft=1` setiap kali prompt diubah: review hasilnya di `/cms`, baru biarkan
jadwal menerbitkan secara normal.

---

## 7. Gotcha

- **Job blog harus fire tiap jam.** Ia mengejar target harian; kalau firing-nya lebih
  jarang dari target, ia diam-diam menghasilkan 0 artikel **tanpa error**. Persis ini
  yang pernah terjadi pada job blog drwskincare selama berhari-hari.
- **Pakai `curl -fsS`, bukan `curl -s`.** Tanpa `-f`, app mati atau redirect tetap
  exit 0 dan job terlihat hijau di Cronicle.
- **Endpoint wajib terdaftar di `isPublicRoute`** (`src/middleware.ts`). Kalau tidak,
  Clerk `auth.protect()` membalas 404 sebelum cek Bearer sempat jalan — bug yang sama
  pernah membuat `/products` tidak bisa diindeks.
- **Judul event Cronicle tidak boleh mengandung `<` atau `>`** → "Malformed title".
  Em-dash `—` aman.
- **API Cronicle membalas HTTP 200 walau auth gagal.** Cek isi body (`{"code":"api"}`),
  bukan status code.
- **Jangan duplikat job ini di GitHub Actions.** Concurrency group tidak berlaku lintas
  sistem, hasilnya artikel dobel.
- **Payload auto-push hanya di dev.** Menjalankan `next dev` dengan `DATABASE_URI`
  menunjuk ke DB CMS produksi akan mencoba `ALTER TABLE` dan gagal (kolom `content`
  di prod bertipe `varchar`, config-nya menginginkan `jsonb`). Produksi tidak pernah
  auto-push, jadi drift ini dorman — tapi jangan arahkan dev ke DB prod.
- **Node 25 mematahkan loader Payload** (`loadEnv` / `ci-info` gagal di interop CJS).
  Skrip Payload standalone harus dijalankan di Node 22 — di dalam container, bukan di Mac.

---

## 8. Peta berkas

| Berkas | Isi |
|---|---|
| `src/lib/seo-engine/dataforseo.ts` | `hasBudget`, `balance`, `serpRank`, `keywordIdeas`, `onPageInstant` |
| `src/lib/seo-engine/gemini.ts` | prompt produksi + `generateArticle`, `generateCover` |
| `src/lib/seo-engine/facts.ts` | blok DATA, `COMPANY`, `KEYWORD_CLUSTER`, foto sumber cover |
| `src/lib/seo-engine/topics.ts` | `CLUSTER_QUEUE` + `pickTopic` |
| `src/lib/seo-engine/lexical.ts` | blok terstruktur → Lexical `editorState` |
| `src/lib/seo-engine/notify.ts` | Telegram |
| `src/lib/seo-engine/cron-auth.ts` | guard Bearer `CRON_SECRET` |
| `src/app/api/cron/seo-blog/route.ts` | job auto-blog |
| `src/app/api/cron/seo-audit/route.ts` | job audit |
| `src/app/(frontend)/admin/seo/page.tsx` | riwayat audit (`/admin/seo`) |
| `prisma/migrations/20260809000000_add_seo_audit_runs/` | tabel `seo_audit_runs` |
