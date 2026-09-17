# Login member melalui WhatsApp

## Konfigurasi Meta yang sudah dibuat

- Akun WhatsApp: **DRW Primé Notif**.
- Nomor pengirim: **+62 815-4288-8666**.
- Phone Number ID: `1289265457605367`.
- WhatsApp Business Account ID: `1582527303359828`.
- Template: `drwprime_member_login_otp`, kategori Authentication, bahasa `id`.
- Tombol: **Salin Kode**. Kedaluwarsa kode dan batas pengiriman: **5 menit**.
- Status yang diverifikasi di Meta pada 11 September 2026: **Aktif – Menunggu kualitas**.
- Template notifikasi treatment: `treatment_completed_member` untuk member akun dan `treatment_completed_walkin` untuk walk-in. Keduanya memakai bahasa `id`, kategori Utility, dan terverifikasi berstatus `APPROVED` melalui Meta API pada 17 September 2026.
- Aplikasi: **DRW Prime OTP API**.
- System user: **DRW Prime Member OTP**, role Employee, akses ke aplikasi OTP dan akun WhatsApp tersebut.
- Izin token yang diminta: `whatsapp_business_messaging`, `whatsapp_business_management`. Izin aset WhatsApp dibatasi ke pesan dan pembacaan nomor/template.

Persetujuan permintaan awal sudah diverifikasi di Meta dengan status **Disetujui** pada 11 September 2026. Namun melanjutkan melalui tombol Buat token kembali menghasilkan permintaan persetujuan, bukan nilai token. Permintaan ulang tanpa kedaluwarsa sudah dibatalkan.

Percobaan dengan masa berlaku **60 hari**, sesuai rekomendasi dokumentasi Meta, juga memerlukan persetujuan. [Permintaan 60 hari yang aktif](https://business.facebook.com/latest/settings/requests?business_id=796589303536225&selected_request_id=27924183693950297) sekarang terverifikasi berstatus **Disetujui** oleh Prasetyo Adi Sutopo; Meta menampilkan persetujuan sekitar 10 jam yang lalu. Jangan membuat permintaan baru lagi untuk memeriksa status. Token perlu diterbitkan dari permintaan yang sudah disetujui.

Token 60 hari sudah berhasil diterbitkan dari permintaan yang disetujui, diverifikasi terhadap nomor pengirim yang diminta, dan disimpan lokal di `.env.local` dengan mode `0600`. Nilai token tidak dicantumkan dalam dokumentasi, Git, URL, atau log. Request OTP nyata ke nomor uji mendapat respons HTTP 200 dan kode berhasil diverifikasi melalui endpoint member; alur berhenti di tahap pendaftaran karena profil uji belum diisi. Catat tanggal kedaluwarsa aktual saat rotasi token disiapkan; masa berlaku token API berbeda dengan kedaluwarsa OTP 5 menit.

## Environment server

Simpan melalui konfigurasi runtime server (lihat `DEPLOYMENT.md`). Nilai rahasia tidak memakai prefiks `NEXT_PUBLIC_`.

```dotenv
NEXT_PUBLIC_APP_URL=https://drwprime.com
MEMBER_WHATSAPP_ACCESS_TOKEN=<token-system-user-setelah-disetujui>
MEMBER_WHATSAPP_PHONE_NUMBER_ID=1289265457605367
MEMBER_WHATSAPP_API_VERSION=v25.0
MEMBER_WHATSAPP_TEMPLATE=drwprime_member_login_otp
MEMBER_WHATSAPP_TEMPLATE_LANG=id
MEMBER_WHATSAPP_TREATMENT_MEMBER_TEMPLATE=treatment_completed_member
MEMBER_WHATSAPP_TREATMENT_WALKIN_TEMPLATE=treatment_completed_walkin
MEMBER_OTP_SECRET=<rahasia-acak-terpisah-minimal-32-karakter>
MEMBER_TRUST_PROXY=true
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/staff/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/staff/sign-in
```

`MEMBER_TRUST_PROXY=true` hanya digunakan di belakang reverse proxy yang **menimpa** `X-Real-IP` dengan IP koneksi sebenarnya, misalnya `proxy_set_header X-Real-IP $remote_addr;`. Pastikan endpoint aplikasi tidak dapat diakses langsung dengan header buatan pengguna. Tanpa pengaturan ini, permintaan memakai satu bucket IP konservatif bersama.

Login member memakai konfigurasi `MEMBER_*` secara eksklusif. Kredensial notifikasi umum dan OPS tidak menjadi fallback. Jika token/secret belum lengkap, formulir menunjukkan layanan sedang disiapkan dan pengiriman mengembalikan 503. Tidak ada OTP tetap atau bypass development.

Notifikasi treatment memakai sender Meta yang sama, tetapi tidak memakai template OTP. Saat seluruh tindakan wajib pada order selesai, aplikasi memberi poin satu kali berdasarkan `finalPrice`, memilih template menurut `User.hasAccount`, dan mengirim nomor yang sudah dinormalisasi ke format `628…`. Nomor yang ambigu atau tidak dapat dikaitkan dengan member dicatat sebagai audit skip agar poin tidak masuk ke orang yang salah.

## Alur akun dan data lama

1. Nomor dinormalisasi menjadi `628…` dan OTP dikirim melalui template Meta.
2. OTP terikat pada browser peminta, berlaku 300 detik, sekali pakai, maksimal 5 percobaan.
3. Akun dengan `loginPhone` terverifikasi masuk melalui sesi database/cookie HttpOnly, Secure di produksi, SameSite=Lax. Masa sesi maksimal 30 hari; logout menghapus sesi server.
4. Nomor yang belum memiliki data member melanjutkan pendaftaran. Nama dan email profil tidak pernah memberikan hak admin atau kepemilikan kode afiliasi yang disediakan untuk suatu email.
5. Nomor yang cocok dengan satu record lama meminta tanggal lahir sesuai data klinik. Aktivasi memperbarui record yang sama sehingga ID, poin, komisi, QR, kode afiliasi, dan relasi transaksi tetap terhubung. NIK tetap disimpan sebagai data klinik, tetapi tidak menjadi syarat login atau aktivasi membership.
6. Nomor duplikat setelah normalisasi, data lama tanpa tanggal lahir, atau nomor kontak yang terkait dengan akun bernomor login lain diarahkan ke Front Office.

Pada cutover OTP, migrasi `20260916120000_force_member_otp_relogin` menghapus seluruh sesi member yang sudah tersimpan. Browser yang masih memiliki sesi Clerk lama juga otomatis dikeluarkan saat aplikasi dibuka kembali; sesi admin/staf yang lolos `requireAdmin()` tidak disentuh.

`User.phone` adalah kontak pasien. `User.loginPhone` adalah identitas login terverifikasi. Impor AIDO/FO tetap menulis kontak, bukan identitas login. Pembaruan profil member tidak mengubah nomor login atau menggabungkan record pasien.

Front Office dapat membuka detail member → **Aktivasi / pemulihan login WhatsApp**, mencatat verifikasi identitas, dan menyetujui nomor untuk 24 jam. Persetujuan mencabut sesi lama dan memblokir login lama. Pemilik nomor yang disetujui tetap harus lolos OTP sebelum nomor login diubah. Jika persetujuan kedaluwarsa, FO perlu memperbaruinya. Catatan tersimpan di `MemberPhoneRecovery` dengan aktor Clerk, alasan, waktu kedaluwarsa, dan waktu pemakaian.

Login staf tersedia di `/staff/sign-in` menggunakan Clerk. API staf tetap memerlukan `requireAdmin()`. Cookie member, termasuk milik member dengan flag database `isAdmin`, tidak memenuhi autentikasi staf. Login OPS tetap menggunakan modul OPS tersendiri.

## Pembatasan dan pengujian

- Kirim ulang setelah 60 detik, maksimal 5 permintaan per nomor dan 20 per bucket IP dalam 15 menit.
- Pengiriman gagal tetap dihitung. Reservasi challenge dan pemeriksaan batas permintaan memakai transaction locks PostgreSQL.
- OTP disimpan sebagai HMAC, sesi/grant sebagai hash. Tidak ada kode OTP atau token sesi dalam JSON respons.
- Grant pendaftaran/aktivasi berlaku 10 menit, terikat browser, sekali pakai, dan maksimal 5 percobaan identitas.
- Mutasi member memverifikasi Origin. URL kembali dibatasi ke halaman member/publik yang diperbolehkan.
- Service worker tidak menyimpan halaman akun/admin atau API; versi cache dinaikkan untuk membersihkan cache HTML lama.

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Tes integrasi di `src/lib/member-auth/service.integration.test.ts` membuat cluster PostgreSQL sementara, memakai database uji terpisah, dan menghapusnya setelah selesai. Tes tidak menggunakan `DATABASE_URL` dari environment. Transport WhatsApp dimock; tes tidak mengirim pesan nyata. Docker menjalankannya sebagai user non-root.

Build lokal membutuhkan konfigurasi Clerk/database/Payload. Untuk pemeriksaan build tanpa layanan produksi, gunakan nilai uji yang sudah didefinisikan pada `.github/workflows/ci.yml`. Nilai uji tersebut bukan konfigurasi deploy.

## Aktivasi produksi

1. Token Meta 60 hari sudah disetujui, diterbitkan, dan diverifikasi memiliki akses ke nomor di atas.
2. Isi environment runtime, termasuk proxy/IP dan rahasia OTP baru. Preflight deployment menolak konfigurasi member yang belum lengkap sebelum migrasi/swap container.
3. Terapkan migrasi `20260911100000_add_member_whatsapp_auth` dan `20260916120000_force_member_otp_relogin` melalui alur deployment. Migrasi kedua menghapus sesi member lama agar semua anggota mengulang login OTP; Clerk ID, data klinik, dan relasi transaksi tetap dipertahankan.
4. Verifikasi kode OTP nyata sudah berhasil. Berikutnya uji pendaftaran dengan data uji terkontrol, aktivasi data lama hanya dengan tanggal lahir, logout, serta pemulihan lewat FO.
5. Verifikasi akses staf dan akses anggota dari browser terpisah. Pergantian login member ke WhatsApp dilakukan pada release ini setelah seluruh konfigurasi tersedia.
