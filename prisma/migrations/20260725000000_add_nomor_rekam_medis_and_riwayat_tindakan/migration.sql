-- AlterTable: add nomor_rekam_medis to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "nomor_rekam_medis" TEXT;

-- CreateIndex: unique nomor_rekam_medis
CREATE UNIQUE INDEX IF NOT EXISTS "users_nomor_rekam_medis_key" ON "users"("nomor_rekam_medis");

-- CreateTable: riwayat_tindakan
CREATE TABLE IF NOT EXISTS "riwayat_tindakan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tanggal_kunjungan" TIMESTAMP(3) NOT NULL,
    "deskripsi_tindakan" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "riwayat_tindakan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "riwayat_tindakan_userId_idx" ON "riwayat_tindakan"("userId");
CREATE INDEX IF NOT EXISTS "riwayat_tindakan_tanggal_kunjungan_idx" ON "riwayat_tindakan"("tanggal_kunjungan");

-- AddForeignKey
ALTER TABLE "riwayat_tindakan" ADD CONSTRAINT "riwayat_tindakan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
