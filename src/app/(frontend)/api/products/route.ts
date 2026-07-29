import { NextResponse } from 'next/server';
import { getActiveProducts, getActiveCategories } from '@/lib/products/catalog';
import { resolveEffectivePrice } from '@/lib/products/pricing';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function GET() {
  try {
    const [products, categories] = await Promise.all([
      getActiveProducts(),
      getActiveCategories(),
    ]);

    const now = new Date();

    const catalog = products.map((product) => {
      const pricing = resolveEffectivePrice(Number(product.price), product.promotions, now);
      return {
        id: product.id,
        slug: product.slug,
        name: product.name,
        headline: product.headline,
        description: product.description,
        size: product.size,
        image: product.imageUrl,
        category: product.category.name,
        categoryId: product.category.slug,
        categoryName: product.category.name,
        benefits: product.benefits,
        caraPakai: product.usageInstructions,
        cta: product.ctaText,
        price: product.price,
        listPrice: pricing.listPrice,
        effectivePrice: pricing.effectivePrice,
        discountAmount: pricing.discountAmount,
        promotion: pricing.promotion,
        sortOrder: product.sortOrder,
        isActive: product.isActive,
      };
    });

    const catList = categories.map((c) => ({
      id: c.slug,
      name: c.name,
    }));

    return NextResponse.json({ products: catalog, categories: catList });
  } catch (error) {
    console.error('[PRODUCTS API] Error:', error);
    return NextResponse.json(
      { error: 'Gagal memuat katalog produk' },
      { status: 500 }
    );
  }
}
