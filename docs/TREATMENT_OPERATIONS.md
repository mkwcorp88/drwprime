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

Buka `http://localhost:3010/treatment-ops/login` dan masuk dengan email akun demo.

Konfigurasi lokal sudah disediakan di `.env.local` (di-ignore oleh git). `.env.local` menunjuk `DATABASE_URL` ke PostgreSQL lokal, sehingga `prisma db push` dan dev server memakai database lokal alih-alih database produksi yang tidak terjangkau dari mesin ini.

## Database

Modul menggunakan tabel berawalan `ops_` agar terpisah dari data website publik, membership, dan katalog treatment lama.

```bash
npm run db:migrate
npm run db:seed:treatment-ops
```

Seed membuat satu cabang, akun staf operasional, dua terapis, satu dokter, satu pasien demo, dan template Facial Brightening. Modul memakai login internal dengan email dan password Argon2, terpisah dari Clerk website utama.

Akun demo localhost memakai password awal `PrimeDemo2026!` dan wajib menggantinya saat login pertama. Email tersedia dengan pola `superadmin@drwprime.local`, `manajemen@drwprime.local`, `frontoffice@drwprime.local`, `supervisor@drwprime.local`, `terapisa@drwprime.local`, `terapisb@drwprime.local`, dan `dokter@drwprime.local`. Atur `OPS_DEMO_PASSWORD` saat menjalankan seed bila membutuhkan password awal lain.

Super Admin membuat akun staf produksi dari `/treatment-ops/staff`. Setiap akun mendapat email login dan password awal yang ditentukan Super Admin. Dashboard terkunci sampai pemilik akun membuat password pribadi dari `/treatment-ops/settings`. Reset password oleh Super Admin mengeluarkan seluruh sesi staf dan mengaktifkan kembali kewajiban ganti password.

## Alur MVP

1. FO membuat order dan mendapatkan QR unik.
2. SPV menugaskan terapis pada tindakan tertentu (opsional).
3. Terapis login dan membuka QR yang sama untuk melihat progres.
4. Terapis memulai dan menyelesaikan tindakan menggunakan waktu server.
5. Penyelesaian membuat ledger insentif secara idempotent.
6. Order menjadi `COMPLETED` setelah seluruh tindakan wajib selesai.

## Kartu QR Staf (barcode karyawan)

Setiap staf punya **barcode kartu pribadi**. Karyawan tidak lagi memindai QR; yang memindai adalah Super Admin. Alur yang disarankan:

1. Super Admin/Manajemen membuka `/treatment-ops/badges` dan menerbitkan kartu untuk tiap staf.
2. Karyawan membuka menu **Barcode Saya** (`/treatment-ops/scan`) dan menampilkan barcode kartunya.
3. Super Admin di dashboard memilih order dan tindakan, lalu klik **Mulai** atau **Selesai**.
4. Kamera dashboard membaca barcode kartu karyawan.
5. Sistem mencatat identitas karyawan dari kartu, bukan dari akun yang login.

Kartu berisi token acak (`DRW-STAFF:<token>`); hash SHA-256 dipakai untuk verifikasi, token tersimpan agar pemilik bisa menampilkan barcode sendiri. Menerbitkan ulang otomatis membatalkan kartu sebelumnya. Endpoint `start`/`complete` menerima `badgeToken` opsional: jika ada, karyawan diidentifikasi dari kartu. Hanya Super Admin yang boleh memindai kartu.

## Deployment

Subdomain produksi adalah `https://admin.drwprime.com` dan diproksikan Nginx ke container DRW Prime yang sama pada `127.0.0.1:5054`. Middleware memilih antarmuka treatment berdasarkan header host, sehingga website utama tetap berada di `https://drwprime.com`.

Jalankan migration, lalu bootstrap hanya akun Super Admin pertama dengan environment server-side:

```bash
OPS_ADMIN_EMAIL="admin@drwprime.com" \
OPS_ADMIN_PASSWORD="password-awal-kuat" \
npm run ops:bootstrap-admin
```

Jangan menjalankan seed demo di produksi. QR yang dibuat dari dashboard memakai origin browser saat ini, sehingga otomatis mengikuti domain produksi.

Jangan menaruh data pasien dalam payload QR. Implementasi hanya menyimpan token acak pada URL dan hash SHA-256 di database.
