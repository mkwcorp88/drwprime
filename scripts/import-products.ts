import { PrismaClient } from '@prisma/client';
import { products, categories } from '@/data/products';

const prisma = new PrismaClient();

interface CategorySeed {
  slug: string;
  name: string;
  sortOrder: number;
}

const CATEGORY_SEEDS: CategorySeed[] = [
  { slug: 'acne', name: 'Acne Specialized', sortOrder: 0 },
  { slug: 'lumiera', name: 'Lumiera Series', sortOrder: 1 },
  { slug: 'antiaging', name: 'Anti Aging', sortOrder: 2 },
  { slug: 'premium', name: 'Premium', sortOrder: 3 },
];

async function main() {
  console.log('[import-products] Starting product catalog import...');

  const categoryMap = new Map<string, string>();
  for (const cat of CATEGORY_SEEDS) {
    const row = await prisma.productCategory.upsert({
      where: { slug: cat.slug },
      create: { slug: cat.slug, name: cat.name, sortOrder: cat.sortOrder, isActive: true },
      update: { name: cat.name, sortOrder: cat.sortOrder },
    });
    categoryMap.set(cat.slug, row.id);
    console.log(`  Category: ${cat.name} (${row.id})`);
  }

  let created = 0;
  let skipped = 0;

  for (const p of products) {
    const categoryId = categoryMap.get(p.categoryId);
    if (!categoryId) {
      console.warn(`  WARN: Unknown categoryId "${p.categoryId}" for product "${p.name}" — skipping`);
      continue;
    }

    const slug = p.id;
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.product.create({
      data: {
        categoryId,
        slug,
        name: p.name,
        headline: p.headline,
        description: p.description,
        price: p.price,
        size: p.size,
        imageUrl: p.image,
        imageKey: null,
        imageAlt: p.name,
        benefits: p.manfaat,
        usageInstructions: p.caraPakai,
        ctaText: p.cta,
        sortOrder: products.indexOf(p),
        isActive: true,
      },
    });
    created++;
    console.log(`  Product: ${p.name}`);
  }

  console.log(`\n[import-products] Done. Created ${created}, skipped ${skipped} existing products.`);
}

main()
  .catch((e) => {
    console.error('[import-products] Import failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
