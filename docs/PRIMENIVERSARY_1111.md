# Primeniversary 11.11 Celebrate

## Operasional

- Halaman publik: `/primeniversary`. Pendaftaran dibuka pada **11 November 2026, 00.00–23.59 WIB**; batas waktu diperiksa kembali di server.
- Form menyimpan nama, nomor WhatsApp, email opsional, dan waktu persetujuan. Harga paket Rp1.111.000 ditetapkan server; kode pendaftaran ditampilkan setelah data tersimpan.
- Data paket tampil di dashboard `/front-office`, di bawah daftar Reservations. Tabel dan API hanya dapat diakses staf yang masuk.
- Tim Front Office menghubungi pelanggan dan memeriksa pembayaran secara manual. Pilih **Konfirmasi pembayaran** hanya setelah pembayaran benar-benar diterima. Sistem belum menerima pembayaran dan tidak mengirim pesan WhatsApp secara otomatis.
- Saat dikonfirmasi, paket aktif selama satu tahun kalender sejak waktu konfirmasi, menggunakan waktu WIB. ED tidak berubah jika konfirmasi dikirim ulang. Pendaftaran yang belum dibayar dapat dibatalkan.
- Nilai terkonfirmasi pada tabel adalah jumlah harga paket yang ditandai terbayar, termasuk yang sudah kedaluwarsa; bukan integrasi otomatis dengan laporan kas atau transaksi AIDO.
- IPL Acne, Glow, Vascular, dan Hair Removal mengikuti rekomendasi dokter dan reservasi. Area Hair Removal perlu dikonfirmasi tim klinik; aplikasi ini belum mencatat sesi atau jumlah pemakaian treatment.

## Rilis

Migrasi `20261109000000_add_primeniversary_registrations` bersifat menambah tabel baru dan harus diterapkan sebelum kode baru menerima pendaftaran. Proses deploy standar menerapkan migrasi melalui `prisma migrate deploy` sebagaimana dijelaskan di `docs/DEPLOYMENT.md`.

Tanggal kampanye berada di `src/lib/primeniversary.ts` dan teks yang terlihat pengunjung di `src/app/(frontend)/primeniversary/page.tsx` serta `src/components/primeniversary/RegistrationForm.tsx`. Jika jadwal atau tahun berubah, perbarui semuanya sebelum rilis.
