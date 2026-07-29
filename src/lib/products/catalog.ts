import { prisma } from '@/lib/prisma';
import type { Product, ProductCategory, ProductPromotion } from '@prisma/client';

export type CatalogProduct = Product & {
  category: ProductCategory;
  promotions: ProductPromotion[];
};

export async function getActiveCategories(): Promise<ProductCategory[]> {
  return prisma.productCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function getActiveProducts(): Promise<CatalogProduct[]> {
  const now = new Date();
  return prisma.product.findMany({
    where: { isActive: true },
    include: {
      category: true,
      promotions: {
        where: {
          isActive: true,
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
        orderBy: { startsAt: 'desc' },
        take: 1,
      },
    },
    orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
  });
}

export async function getProductById(id: string): Promise<CatalogProduct | null> {
  return prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      promotions: { orderBy: { startsAt: 'desc' } },
    },
  });
}

export async function getProductBySlug(slug: string): Promise<CatalogProduct | null> {
  return prisma.product.findUnique({
    where: { slug },
    include: {
      category: true,
      promotions: { orderBy: { startsAt: 'desc' } },
    },
  });
}

export async function getAllProductsAdmin(): Promise<(Product & { category: ProductCategory; promotions: ProductPromotion[] })[]> {
  return prisma.product.findMany({
    include: {
      category: true,
      promotions: { orderBy: { startsAt: 'desc' } },
    },
    orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
  });
}

export async function getPromotionsByProductId(productId: string): Promise<ProductPromotion[]> {
  return prisma.productPromotion.findMany({
    where: { productId },
    orderBy: { startsAt: 'desc' },
  });
}
