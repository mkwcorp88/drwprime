# DRW Prime — Impor Karyawan & Treatment

Salin file ini, isi data asli, lalu jalankan:

```bash
npm run ops:import-md -- /path/ke/file-anda.md
```

## Karyawan

Kolom: Email | Nama | ID | Role | Cabang | Password

- Role: `Super Admin`, `Manajemen`, `Front Office`, `Supervisor`, `Terapis`, `Dokter`.
- Cabang: gunakan kode cabang, mis. `DRW-UTAMA`.
- Password: opsional. Jika dikosongkan, sistem membuat password acak dan menampilkannya di akhir impor. Semua akun wajib mengganti password saat login pertama.

| Email | Nama | ID | Role | Cabang | Password |
|---|---|---|---|---|---|
| budi.santoso@example.com | Budi Santoso | TRP-002 | Terapis | DRW-UTAMA | |
| sari.wulandari@example.com | Sari Wulandari | DR-002 | Dokter | DRW-UTAMA | |
| rina@example.com | Rina Marlina | FO-002 | Front Office | DRW-UTAMA | |

## Treatment

Setiap treatment diawali judul `### Nama (KODE)` lalu baris metadata `Kategori: ... | Harga: ...`, diikuti tabel tahapan:

- Kolom tabel tahapan: No | Tindakan | Wajib | Role | Menit | Insentif
- `Wajib`: `ya` / `tidak`.
- `Role`: `Terapis` / `Dokter` (boleh kosong untuk semua eksekutor).
- `Menit`: durasi estimasi (opsional).
- `Insentif`: nominal insentif.

### Facial Brightening (FAC-BRIGHT)
Kategori: Facial | Harga: 350000
| No | Tindakan | Wajib | Role | Menit | Insentif |
|---|---|---|---|---|---|
| 1 | Persiapan dan cleansing | ya | Terapis | 10 | 3000 |
| 2 | Ekstraksi | tidak | Terapis | 10 | 4000 |
| 3 | Massage | ya | Terapis | 15 | 7000 |
| 4 | Aplikasi masker | ya | Terapis | 5 | 2000 |
| 5 | Angkat masker | ya | Terapis | 5 | 2000 |
| 6 | Finishing | ya | Terapis | 5 | 2000 |

### Konsultasi & Perawatan (KONSUL-FULL)
Kategori: Facial | Harga: 500000
| No | Tindakan | Wajib | Role | Menit | Insentif |
|---|---|---|---|---|---|
| 1 | Konsultasi dokter | ya | Dokter | 15 | 5000 |
| 2 | Persiapan dan cleansing | ya | Terapis | 10 | 3000 |
| 3 | Perawatan utama | ya | Terapis | 20 | 8000 |
| 4 | Finishing | ya | Terapis | 5 | 2000 |
