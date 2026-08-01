import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

function readMigrationSql(): string[] {
  const migrationDir = path.join(process.cwd(), 'prisma', 'migrations', '20260729000000_add_product_catalog_promotions');
  const sql = fs.readFileSync(path.join(migrationDir, 'migration.sql'), 'utf-8');

  return sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));
}

async function seedCategories() {
  const categories = [
    { name: 'Facial Wash', slug: 'facial-wash', sortOrder: 1 },
    { name: 'Moisturizer', slug: 'moisturizer', sortOrder: 2 },
    { name: 'Sunscreen', slug: 'sunscreen', sortOrder: 3 },
    { name: 'Serum', slug: 'serum', sortOrder: 4 },
    { name: 'Toner', slug: 'toner', sortOrder: 5 },
  ];

  const results: string[] = [];

  try {
    await prisma.$executeRawUnsafe(`DELETE FROM "product_categories" WHERE "name" = '100ml'`);
    results.push('Deleted "100ml" category');
  } catch {
    /* may not exist */
  }

  for (const cat of categories) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "product_categories" ("id", "slug", "name", "sort_order") 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT ("slug") DO UPDATE SET "name" = $3, "sort_order" = $4, "updated_at" = NOW()`,
      crypto.randomUUID(), cat.slug, cat.name, cat.sortOrder
    );
    results.push(`Upserted: ${cat.name}`);
  }

  return results;
}

export async function GET() {
  try {
    const statements = readMigrationSql();
    const results: string[] = [];

    for (const stmt of statements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
        results.push(stmt.substring(0, 80) + '...');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('already exists') ||
          msg.includes('duplicate') ||
          msg.includes('does not exist') ||
          msg.includes('was not found')
        ) {
          results.push(`SKIPPED (${msg.substring(0, 50)})`);
        } else {
          results.push(`FAILED: ${msg.substring(0, 80)}`);
        }
      }
    }

    const seedResults = await seedCategories();

    return NextResponse.json({
      success: true,
      migration: results,
      seed: seedResults,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Setup failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
