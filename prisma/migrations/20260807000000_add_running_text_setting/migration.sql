CREATE TABLE "running_text_settings" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "running_text_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "running_text_settings" ("id", "text", "created_at", "updated_at")
VALUES (
    'global',
    '✨ Promo Spesial Hari Ini: Gratis Ongkir Seluruh Indonesia! • Gunakan Kode Voucher: DRWPRIME • Diskon s/d 20% Untuk Pembelian Pertama ✨',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
