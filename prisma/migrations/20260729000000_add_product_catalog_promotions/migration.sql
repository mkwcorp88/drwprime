-- Product catalog and scheduled promotions
CREATE TABLE "product_categories" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_categories_slug_key" UNIQUE ("slug"),
  CONSTRAINT "product_categories_name_not_empty" CHECK (BTRIM("name") <> ''),
  CONSTRAINT "product_categories_slug_not_empty" CHECK (BTRIM("slug") <> '')
);

CREATE INDEX "product_categories_is_active_sort_order_idx" ON "product_categories" ("is_active", "sort_order");

CREATE TABLE "products" (
  "id" TEXT NOT NULL,
  "category_id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "headline" TEXT,
  "description" TEXT NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "size" TEXT,
  "image_url" TEXT,
  "image_key" TEXT,
  "image_alt" TEXT,
  "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
  "usage_instructions" TEXT,
  "cta_text" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_clerk_id" TEXT,
  "updated_by_clerk_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "products_slug_key" UNIQUE ("slug"),
  CONSTRAINT "products_image_key_key" UNIQUE ("image_key"),
  CONSTRAINT "products_name_not_empty" CHECK (BTRIM("name") <> ''),
  CONSTRAINT "products_price_positive" CHECK ("price" > 0),
  CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "products_category_id_is_active_sort_order_idx" ON "products" ("category_id", "is_active", "sort_order");
CREATE INDEX "products_is_active_sort_order_idx" ON "products" ("is_active", "sort_order");

CREATE TABLE "product_promotions" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "badge_text" TEXT,
  "final_price" DECIMAL(12,2) NOT NULL,
  "starts_at" TIMESTAMPTZ(3) NOT NULL,
  "ends_at" TIMESTAMPTZ(3) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_clerk_id" TEXT,
  "updated_by_clerk_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "product_promotions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_promotions_product_id_starts_at_key" UNIQUE ("product_id", "starts_at"),
  CONSTRAINT "product_promotions_title_not_empty" CHECK (BTRIM("title") <> ''),
  CONSTRAINT "product_promotions_final_price_non_neg" CHECK ("final_price" >= 0),
  CONSTRAINT "product_promotions_dates_valid" CHECK ("ends_at" > "starts_at"),
  CONSTRAINT "product_promotions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "product_promotions_product_id_is_active_starts_at_ends_at_idx" ON "product_promotions" ("product_id", "is_active", "starts_at", "ends_at");
CREATE INDEX "product_promotions_is_active_starts_at_ends_at_idx" ON "product_promotions" ("is_active", "starts_at", "ends_at");

-- Extend product_orders with security and pricing snapshot fields
ALTER TABLE "product_orders"
  ADD COLUMN "public_token" TEXT,
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "list_subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'IDR',
  ADD COLUMN "pricing_version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "product_orders"
  ADD CONSTRAINT "product_orders_public_token_key" UNIQUE ("public_token"),
  ADD CONSTRAINT "product_orders_idempotency_key_key" UNIQUE ("idempotency_key");

-- Backfill public_token for existing orders
UPDATE "product_orders" SET "public_token" = "id" WHERE "public_token" IS NULL;
ALTER TABLE "product_orders" ALTER COLUMN "public_token" SET NOT NULL;

-- Extend product_order_items with catalog and promotion snapshot fields
ALTER TABLE "product_order_items"
  ADD COLUMN "catalog_product_id" TEXT,
  ADD COLUMN "original_price" DECIMAL(12,2),
  ADD COLUMN "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "applied_promotion_id" TEXT,
  ADD COLUMN "applied_promotion_title" TEXT;

ALTER TABLE "product_order_items"
  ADD CONSTRAINT "product_order_items_catalog_product_id_fkey" FOREIGN KEY ("catalog_product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "product_order_items_applied_promotion_id_fkey" FOREIGN KEY ("applied_promotion_id") REFERENCES "product_promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "product_order_items_catalog_product_id_idx" ON "product_order_items" ("catalog_product_id");
CREATE INDEX "product_order_items_applied_promotion_id_idx" ON "product_order_items" ("applied_promotion_id");
