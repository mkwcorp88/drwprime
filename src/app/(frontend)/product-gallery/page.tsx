import { getActiveProducts, getActiveCategories, getActiveBanners } from '@/lib/products/catalog';
import { resolveEffectivePrice } from '@/lib/products/pricing';
import ProductGalleryClient from './components/ProductGalleryClient';
import MobileLayout from '@/components/MobileLayout';
import Navbar from '@/components/Navbar';
import type { CatalogProduct, CatalogCategory } from '@/features/product-commerce/types';
import type { GalleryBanner } from './components/ProductGalleryBannerSlider';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function ProductGalleryPage() {
  let products: CatalogProduct[] = [];
  let categories: CatalogCategory[] = [];
  let banners: GalleryBanner[] = [];

  try {
    const [rawProducts, rawCategories, rawBanners] = await Promise.all([
      getActiveProducts(),
      getActiveCategories(),
      getActiveBanners(),
    ]);

    const now = new Date();
    products = rawProducts.map((product) => {
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
        classification: product.classification,
        benefits: product.benefits,
        caraPakai: product.usageInstructions,
        cta: product.ctaText,
        price: Number(product.price),
        listPrice: pricing.listPrice,
        effectivePrice: pricing.effectivePrice,
        discountAmount: pricing.discountAmount,
        promotion: pricing.promotion,
        sortOrder: product.sortOrder,
        isActive: product.isActive,
      };
    });

    categories = rawCategories.map((c) => ({
      id: c.slug,
      name: c.name,
    }));

    banners = (rawBanners || []).map((b) => ({
      id: b.id,
      imageDesktopUrl: b.imageDesktopUrl,
      imageMobileUrl: b.imageMobileUrl,
      imageAlt: b.imageAlt,
      heading: b.heading,
      description: b.description,
      ctaText: b.ctaText,
      ctaLink: b.ctaLink,
    }));
  } catch (error) {
    console.error('[PRODUCT GALLERY] Server data fetch error:', error);
  }

  return (
    <MobileLayout showHeader={true} showBottomNav={true}>
      <Navbar />
      <main className="pt-16 lg:pt-[88px]">
        <ProductGalleryClient initialProducts={products} initialCategories={categories} banners={banners} />
      </main>
    </MobileLayout>
  );
}
