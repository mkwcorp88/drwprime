# Login staf DRW Prime tanpa Clerk

Front Office dan marketing memakai sesi staf DRW Prime (`drw_staff_session`), terpisah dari sesi member dan operasional treatment. Halaman `/staff/sign-in` menawarkan Google dan OTP WhatsApp. Hanya `StaffAccount` aktif yang dapat masuk; login Google mencocokkan subject Google yang sudah terikat, atau email Google terverifikasi yang pernah diimpor dari akun staf lama. Tidak ada pendaftaran staf otomatis dari akun member.

## Migrasi satu kali akun lama

Migrasi `20261024000000_add_staff_auth` hanya menambah tabel; jalankan migrasi tersebut **sebelum** mengalihkan login staf dari Clerk. Setelah tabel tersedia, jalankan sekali dengan `CLERK_SECRET_KEY` dari environment server:

```bash
npm run staff:import-clerk-once -- --dry-run
npm run staff:import-clerk-once
```

Skrip mengambil ID admin lama yang masih aktif dari daftar admin dan database, termasuk akun dengan email admin yang dikonfigurasi. Hanya email/nomor yang berstatus terverifikasi di Clerk yang diimpor. ID lama yang sudah tidak ada dilewati. Skrip tidak mencetak email, nomor, token, atau data klinik; hanya jumlah akun/identitas yang dipindahkan. Pastikan setidaknya satu staf dapat masuk melalui Google sebelum mengalihkan halaman staf. Identitas lama disimpan sebagai `legacyClerkId` agar referensi aktor pada Front Office dan assignment marketing tetap sama.

Staf yang diimpor tanpa nomor dapat masuk melalui email Google terverifikasi, lalu membuka `/staff/profile` untuk menambahkan nomor WhatsApp dengan OTP. Setelah verifikasi, nomor itu juga dapat dipakai untuk login staf. Nomor baru tidak langsung menjadi kredensial hanya karena ditulis pada formulir. Jika suatu akun lama tidak mempunyai email maupun nomor terverifikasi, identitasnya perlu diselesaikan oleh administrator sebelum cutover.

CMS Payload memakai autentikasinya sendiri di `/cms/login`. Auto-login melalui `/api/cms-auto-login` hanya tersedia bagi staf yang ditandai `cmsAccess` secara eksplisit; tidak ada peningkatan hak CMS berdasarkan email semata.

## Pemeriksaan

1. Akun staf yang terdaftar dapat masuk via Google dan membuka `/front-office` serta `/marketing`.
2. Akun Google member/akun tidak terdaftar mendapat 403 dari login staf dan API staf.
3. Staf tanpa nomor dapat memverifikasi WhatsApp di `/staff/profile`, keluar, lalu masuk lagi dengan OTP.
4. Cookie member tidak memberi akses Front Office. Staf nonaktif atau sesi kedaluwarsa juga ditolak.
5. Jalankan `npm run typecheck`, `npm run lint`, `npm run test`, dan `npm run build` sebelum rollout.

Jangan deploy cutover halaman staf jika tabel `StaffAccount` belum diisi: akun Clerk lama tidak akan memenuhi autentikasi staf baru. Hapus ketergantungan SDK Clerk satu kali setelah impor dan validasi staf selesai.
