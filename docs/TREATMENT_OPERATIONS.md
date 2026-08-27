# DRW Prime Treatment Operations

Modul internal untuk pencatatan alur tindakan pasien dan perhitungan insentif terapis. Implementasi mengikuti prinsip satu order treatment memiliki satu QR, sedangkan pelaksana dan insentif dicatat pada setiap tindakan.

## URL

- Dashboard: `/treatment-ops`
- Scan terapis: `/treatment-ops/scan`
- Kartu QR staf: `/treatment-ops/badges`
- Report: `/treatment-ops/report`
- Laporan insentif: `/treatment-ops/incentives`
- Subdomain produksi: `https://admin.drwprime.com`

Middleware akan me-rewrite root subdomain `admin.drwprime.com` ke `/treatment-ops`.

## Menjalankan lokal (localhost)

Modul memakai PostgreSQL embedded sehingga tidak perlu instalasi database sistem. Buka dua terminal:

```bash
# Terminal 1 — database lokal (port 5433, data di .local-postgres/)
npm run db:local
```

```bash
# Terminal 2 — sekali saja: sinkronkan schema dan seed
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/drwprime_local" npx prisma db push
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/drwprime_local" npm run db:seed:treatment-ops
```

```bash
# Terminal 2 — jalankan aplikasi (baca .env.local)
npm run dev:ops
```

Buka `http://localhost:3010/treatment-ops/login` dan masuk dengan akun demo.

Konfigurasi lokal sudah disediakan di `.env.local` (di-ignore oleh git). `.env.local` menunjuk `DATABASE_URL` ke PostgreSQL lokal, sehingga `prisma db push` dan dev server memakai database lokal alih-alih database produksi yang tidak terjangkau dari mesin ini.

## Database

Modul menggunakan tabel berawalan `ops_` agar terpisah dari data website publik, membership, dan katalog treatment lama.

```bash
npm run db:migrate
npm run db:seed:treatment-ops
```

Seed membuat satu cabang, akun staf operasional, dua terapis, satu dokter, satu pasien demo, dan template Facial Brightening. Modul memakai login internal dengan username dan password Argon2, terpisah dari Clerk website utama.

Akun demo localhost menggunakan password `PrimeDemo2026!`: `superadmin`, `manajemen`, `frontoffice`, `supervisor`, `terapisa`, `terapisb`, dan `dokter`. Atur `OPS_DEMO_PASSWORD` ketika menjalankan seed dan ganti seluruh password sebelum produksi.

## Alur MVP

1. FO membuat order dan mendapatkan QR unik.
2. SPV menugaskan terapis pada tindakan tertentu (opsional).
3. Terapis login dan membuka QR yang sama untuk melihat progres.
4. Terapis memulai dan menyelesaikan tindakan menggunakan waktu server.
5. Penyelesaian membuat ledger insentif secara idempotent.
6. Order menjadi `COMPLETED` setelah seluruh tindakan wajib selesai.

## Kartu QR Staf (scan dari dashboard)

Selain login sendiri, setiap staf punya **kartu QR pribadi**. Alur yang disarankan:

1. Super Admin/Manajemen membuka `/treatment-ops/badges` dan menerbitkan kartu QR untuk tiap terapis.
2. Dashboard (FO/SPV/Manajemen) memilih order dan tindakan, lalu klik **Mulai** atau **Selesai**.
3. Kamera dashboard membaca QR kartu terapis.
4. Sistem mencatat identitas terapis dari kartu, bukan dari akun dashboard.

Kartu hanya berisi token acak (`DRW-STAFF:<token>`); database menyimpan hash SHA-256. Menerbitkan ulang otomatis membatalkan kartu sebelumnya. Endpoint `start`/`complete` menerima `badgeToken` opsional: jika ada, terapis diidentifikasi dari kartu; jika tidak, pemanggil harus terapis yang login sendiri.

## Deployment

Tambahkan `https://admin.drwprime.com` sebagai domain aplikasi setelah routing Nginx VPS disiapkan. Jalankan migration dan seed sebelum membuka modul. QR yang dibuat dari dashboard memakai origin browser saat ini, sehingga otomatis mengikuti domain produksi.

Jangan menaruh data pasien dalam payload QR. Implementasi hanya menyimpan token acak pada URL dan hash SHA-256 di database.
