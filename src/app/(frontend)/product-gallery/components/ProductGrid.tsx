'use client';

import ProductCard from './ProductCard';
import type { CatalogProduct } from '@/features/product-commerce/types';

interface ProductGridProps {
  products: CatalogProduct[];
  onOpenDetail: (p: CatalogProduct) => void;
  onAddToCart: (p: CatalogProduct) => void;
  emptyMessage?: string;
}

export default function ProductGrid({ products, onOpenDetail, onAddToCart, emptyMessage }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <p className="text-white/40 font-medium">{emptyMessage || 'Produk tidak ditemukan'}</p>
        <p className="text-white/25 text-xs mt-1">Coba kata kunci atau kategori lain</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
      {products.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          onOpenDetail={onOpenDetail}
          onAddToCart={onAddToCart}
        />
      ))}
    </div>
  );
}
