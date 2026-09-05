# DRW Prime Treatment Operations

Modul internal untuk pencatatan alur tindakan pasien dan perhitungan insentif terapis. Implementasi mengikuti prinsip satu order treatment memiliki satu QR, sedangkan pelaksana dan insentif dicatat pada setiap tindakan.

## URL

- Dashboard: `/treatment-ops`
- Scan terapis: `/treatment-ops/scan`
- Jadwal libur karyawan: `/treatment-ops/day-off`
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

Buka `http://localhost:3010/treatment-ops/login`. Untuk memakai akun demo berbasis password, set `OPS_WHATSAPP_OTP_ENABLED=false` pada `.env.local`. Untuk menguji OTP, ganti nomor demo dengan nomor WhatsApp nyata dan lengkapi konfigurasi Meta di bawah.

Konfigurasi lokal sudah disediakan di `.env.local` (di-ignore oleh git). `.env.local` menunjuk `DATABASE_URL` ke PostgreSQL lokal, sehingga `prisma db push` dan dev server memakai database lokal alih-alih database produksi yang tidak terjangkau dari mesin ini.

## Database

Modul menggunakan tabel berawalan `ops_` agar terpisah dari data website publik, membership, dan katalog treatment lama.

```bash
npm run db:migrate
npm run db:seed:treatment-ops
```

Seed membuat satu cabang, akun staf operasional, dua terapis, satu dokter, satu pasien demo, dan template Facial Brightening. Modul memakai autentikasi internal yang terpisah dari Clerk website utama.

Akun demo localhost memakai password awal `PrimeDemo2026!` saat mode OTP dimatikan. Email tersedia dengan pola `superadmin@drwprime.local`, `manajemen@drwprime.local`, `frontoffice@drwprime.local`, `supervisor@drwprime.local`, `terapisa@drwprime.local`, `terapisb@drwprime.local`, dan `dokter@drwprime.local`. Atur `OPS_DEMO_PASSWORD` saat menjalankan seed bila membutuhkan password awal lain.

Super Admin membuat akun staf produksi dari `/treatment-ops/staff` dan wajib menetapkan nomor WhatsApp unik. Nomor dinormalisasi menjadi format `62...`; nama, cabang, dan role selalu diambil dari data `OpsStaff`, bukan dari input pengguna saat login. Super Admin juga dapat memperbarui nomor akun lama dari halaman yang sama.

## Login WhatsApp OTP

Mode produksi memakai template Meta Authentication `drwprime_login_otp` berbahasa Indonesia dengan tombol **Salin Kode**. Kode berisi enam digit, berlaku lima menit, maksimal lima percobaan, dan dapat diminta ulang setelah 60 detik. Kode tidak disimpan sebagai teks biasa; database hanya menyimpan HMAC challenge dan rate limit per nomor/IP.

Konfigurasi runtime — **wajib terpisah** dari `WHATSAPP_*` milik POS/member. Login OTP hanya membaca prefiks `OPS_` dan gagal tertutup bila tidak lengkap:

```bash
OPS_WHATSAPP_OTP_ENABLED=true
OPS_WHATSAPP_ACCESS_TOKEN="token-WABA-DRW-Prime"
OPS_WHATSAPP_PHONE_NUMBER_ID="1002114199662987"   # nomor DRW Prime +62 811-3880-0039
OPS_WHATSAPP_TEMPLATE="drwprime_login_otp"
OPS_WHATSAPP_TEMPLATE_LANG="id"
OPS_OTP_SECRET="random-secret-minimal-32-karakter"
```

`OPS_OTP_SECRET` direkomendasikan. Jika belum ada, aplikasi sementara memakai fallback pepper untuk HMAC. Untuk rollback terkontrol ke login email/password, set `OPS_WHATSAPP_OTP_ENABLED=false`; kode password lama tetap tersedia tetapi endpoint-nya dinonaktifkan saat OTP aktif.

## Alur MVP

1. FO membuat order dan mendapatkan QR unik.
2. SPV menugaskan terapis pada tindakan tertentu (opsional).
3. Terapis login dan membuka QR yang sama untuk melihat progres.
4. Terapis memulai dan menyelesaikan tindakan menggunakan waktu server.
5. Penyelesaian membuat ledger insentif secara idempotent.
6. Order menjadi `COMPLETED` setelah seluruh tindakan wajib selesai.

## Jadwal Libur Karyawan

Setiap karyawan dapat menambahkan tanggal libur dari `/treatment-ops/day-off`. Super Admin dan Manajemen juga dapat memilih karyawan lain dalam cakupan cabangnya. Tanggal libur memiliki satu entri per karyawan, dapat diberi catatan, dan hanya berlaku untuk tanggal yang dipilih.

Pada dashboard operasional, karyawan yang libur pada tanggal kunjungan tidak ditampilkan dalam pilihan assignment. Backend juga memblokir assignment atau mulai tindakan pada tanggal tersebut, termasuk jika request dikirim langsung ke API. Assignment yang sudah ada tidak dihapus otomatis agar supervisor dapat menggantinya secara sadar.

## Kartu QR Staf (barcode karyawan)

Setiap staf punya **barcode kartu pribadi**. Karyawan tidak lagi memindai QR; yang memindai adalah Super Admin. Alur yang disarankan:

1. Super Admin/Manajemen membuka `/treatment-ops/badges` dan menerbitkan kartu untuk tiap staf.
2. Karyawan membuka menu **Barcode Saya** (`/treatment-ops/scan`) dan menampilkan barcode kartunya.
3. Super Admin di dashboard memilih order dan tindakan, lalu klik **Mulai** atau **Selesai**.
4. Kamera dashboard membaca barcode kartu karyawan.
5. Sistem mencatat identitas karyawan dari kartu, bukan dari akun yang login.

Kartu berisi token acak (`DRW-STAFF:<token>`); hash SHA-256 dipakai untuk verifikasi, token tersimpan agar pemilik bisa menampilkan barcode sendiri. Menerbitkan ulang otomatis membatalkan kartu sebelumnya. Endpoint `start`/`complete` menerima `badgeToken` opsional: jika ada, karyawan diidentifikasi dari kartu. Hanya Super Admin yang boleh memindai kartu.

## Impor Data dari MD

Impor awal karyawan dan list treatment bisa dilakukan dari satu file Markdown. Contoh format ada di `prisma/import-ops-template.md`.

```bash
npm run ops:import-md -- /path/ke/file.md
```

- **Karyawan**: tabel dengan kolom `Email | WhatsApp | Nama | ID | Role | Cabang | Password`. WhatsApp wajib dan unik. Role memakai label Indonesia (`Terapis`, `Dokter`, `Front Office`, `Supervisor`, `Manajemen`, `Super Admin`). Password tetap boleh dikosongkan untuk kompatibilitas mode rollback. Akun Dokter otomatis ditautkan ke daftar dokter order.
- **Treatment**: tiap treatment diawali `### Nama (KODE)`, baris `Kategori: ... | Harga: ...`, lalu tabel tahapan `No | Tindakan | Wajib | Role | Menit | Insentif`.
- Bersifat idempotent: email/kode yang sudah ada dilewati tanpa ditimpa. Karyawan dan treatment yang tidak valid dilaporkan di akhir tanpa menghentikan impor.

## Deployment

Subdomain produksi adalah `https://admin.drwprime.com` dan diproksikan Nginx ke container DRW Prime yang sama pada `127.0.0.1:5054`. Middleware memilih antarmuka treatment berdasarkan header host, sehingga website utama tetap berada di `https://drwprime.com`.

Jalankan migration, lalu bootstrap hanya akun Super Admin pertama dengan environment server-side:

```bash
OPS_ADMIN_EMAIL="admin@drwprime.com" \
OPS_ADMIN_PHONE="0812xxxxxxxx" \
OPS_ADMIN_PASSWORD="password-awal-kuat" \
npm run ops:bootstrap-admin
```

Jangan menjalankan seed demo di produksi. QR yang dibuat dari dashboard memakai origin browser saat ini, sehingga otomatis mengikuti domain produksi.

Jangan menaruh data pasien dalam payload QR. Implementasi hanya menyimpan token acak pada URL dan hash SHA-256 di database.
