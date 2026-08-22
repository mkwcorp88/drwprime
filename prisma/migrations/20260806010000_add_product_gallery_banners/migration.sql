CREATE TABLE "product_gallery_banners" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "image_desktop_url" TEXT NOT NULL,
    "image_desktop_key" TEXT NOT NULL,
    "image_mobile_url" TEXT,
    "image_mobile_key" TEXT,
    "image_alt" TEXT NOT NULL,
    "heading" TEXT,
    "description" TEXT,
    "cta_text" TEXT,
    "cta_link" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_gallery_banners_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_gallery_banners_is_active_sort_order_idx" ON "product_gallery_banners"("is_active", "sort_order");
