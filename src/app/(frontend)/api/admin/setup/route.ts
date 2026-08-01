import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const CREATE_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS "product_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_categories_slug_key" UNIQUE ("slug")
  )`,

  `CREATE TABLE IF NOT EXISTS "products" (
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
    CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS "product_promotions" (
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
    CONSTRAINT "product_promotions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
];

const CATEGORIES = [
  { slug: 'facial-wash', name: 'Facial Wash', order: 1 },
  { slug: 'moisturizer', name: 'Moisturizer', order: 2 },
  { slug: 'sunscreen', name: 'Sunscreen', order: 3 },
  { slug: 'serum', name: 'Serum', order: 4 },
  { slug: 'toner', name: 'Toner', order: 5 },
];

export async function GET() {
  const results: string[] = [];

  try {
    for (const sql of CREATE_TABLES_SQL) {
      await prisma.$executeRawUnsafe(sql);
      results.push('OK: ' + sql.substring(0, 60).replace(/\n/g, ' '));
    }

    try {
      await prisma.$executeRawUnsafe(`DELETE FROM "product_categories" WHERE "name" = '100ml'`);
      results.push('Deleted "100ml" category');
    } catch { /* ignore */ }

    for (const cat of CATEGORIES) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "product_categories" ("id", "slug", "name", "sort_order") 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT ("slug") DO UPDATE SET "name" = $3, "sort_order" = $4`,
        crypto.randomUUID(), cat.slug, cat.name, cat.order
      );
      results.push(`Upserted: ${cat.name}`);
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Setup failed',
      results,
    }, { status: 500 });
  }
}
