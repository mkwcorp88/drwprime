# CRM DRW Prime

CRM mengelola kontak dari event, ads, organik, referral, dan sumber lain tanpa membuat atau mengubah identitas login member. Pengguna harus memiliki sesi staf aktif dan hak akses CRM tersendiri. Akun awal yang disetujui adalah `drwprimegejayan@gmail.com` dan `drwcorpora@gmail.com` jika sudah terdaftar sebagai staf aktif. Migrasi memberikan peran admin kepada akun tersebut; jika akun diverifikasi melalui Google setelah migrasi, login pertama dapat membuat grant admin yang belum ada. Grant yang dinonaktifkan tidak diaktifkan otomatis.

## Alur dan peran

- Admin mengatur akses staf Prime yang sudah terdaftar. Marketing dan Front Office dapat mengelola kontak, event, dan tindak lanjut. Admin/marketing mengelola campaign dan biaya; admin/Front Office membuat dan memproses reservasi. Manajemen memiliki akses baca.
- CSV UTF-8 dan lembar pertama XLSX memerlukan kolom `Nama` dan `WhatsApp` atau `No HP`; `Layanan` dan `Catatan` opsional. Foto JPG/PNG dan PDF diekstrak dengan Google Gemini. Maksimal tiga file, 5 MB per file, dan 100 baris per batch.
- Petugas wajib meninjau dan mengoreksi hasil sebelum menyimpan. Nomor dinormalisasi untuk mendeteksi duplikat; kontak lama tidak ditimpa. Riwayat event tambahan tetap ditautkan. Dokumen asli dapat dilihat hanya oleh pembuat batch sampai disimpan/dibatalkan atau kedaluwarsa. Batch kedaluwarsa dibersihkan pada upload berikutnya.
- Reservasi CRM dibuat dalam tabel reservasi Prime yang sama sebagai reservasi tamu; email, treatment, tanggal, dan jam diisi oleh petugas. Identitas member tidak diklaim otomatis berdasarkan nomor kontak. Konfirmasi, pembatalan, dan penyelesaian menggunakan state machine Prime, termasuk kebijakan komisi dan poin yang sudah ada.
- Campaign dan sumber reservasi dicatat sebagai snapshot yang dipilih petugas, bukan atribusi otomatis Meta. Biaya iklan manual: satu nilai per campaign dan tanggal, dengan riwayat perubahan.
- Laporan ads menggunakan reservasi CRM bersumber ads menurut tanggal masuk dan biaya menurut tanggal iklan. Omzet adalah pembayaran reservasi yang selesai, bukan laba. Data AIDO tidak otomatis dijumlahkan ke omzet CRM, sehingga tidak menyebabkan penghitungan ganda; transaksi AIDO yang belum ditautkan tidak tercakup. Event menghitung kontak dan tindak lanjut unik per event.

## Konfigurasi produksi

1. Terapkan migrasi `20261108150000_add_prime_crm` melalui pipeline Coolify yang berlaku. Migrasi menambah tabel CRM dan tidak mengubah isi tabel member atau reservasi lama. Backup database sebelum rollout.
2. Tambahkan `CRM_GEMINI_API_KEY` sebagai variabel rahasia runtime aplikasi di Coolify. Opsional: `CRM_GEMINI_MODEL` (default `gemini-flash-latest`). CRM sengaja tidak menggunakan `GEMINI_API_KEY` layanan lain karena dokumen kontak dikirim langsung ke Google. Gunakan key yang mengizinkan IP keluar server; pemakaian mengikuti kuota dan tarif akun Google terkait. Jangan mencatat nilai key ke Git atau log.
3. `crm.drwprime.com` harus diarahkan ke VPS Prime, dengan HTTPS dan reverse proxy yang mempertahankan `Host`, menimpa `X-Real-IP`, dan meneruskan `X-Forwarded-Proto`. Atur `client_max_body_size 18m` serta timeout upstream minimal 300 detik untuk upload dan OCR.
4. Root subdomain CRM diarahkan middleware ke `/crm`. Login menggunakan akun staf yang sudah ada di `drwprime.com`: browser meneruskan tiket sekali pakai ke CRM, terikat ke cookie host-only yang berlaku singkat. Cookie staf main domain tidak dibagi ke subdomain. Pengguna harus menekan tombol lanjut pada halaman konfirmasi.
5. Jalankan `npm run typecheck`, `npm run lint`, `npm run test`, dan `npm run build`; pastikan health check dan login dua admin berhasil setelah rollout. Uji foto/PDF dengan data sintetis terlebih dahulu; akurasi tulisan tangan asli harus diperiksa pengguna.

Untuk uji lokal antarsubdomain, set `CRM_SSO_DEV_DOMAIN=prime.localhost` dan `NEXT_PUBLIC_APP_URL=http://prime.localhost:PORT`, lalu buka `http://crm.prime.localhost:PORT`. Kedua host `.localhost` tetap pada mesin lokal. Jangan memakai database produksi untuk fixture atau integration test.
