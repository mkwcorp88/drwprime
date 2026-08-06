'use client';

import Image from 'next/image';
import type { CatalogProduct } from '@/features/product-commerce/types';
import { getCategoryColor } from '@/features/product-commerce/category-theme';
import { formatPrice } from '@/features/product-commerce/formatters';

interface ProductCardProps {
  product: CatalogProduct;
  onOpenDetail: (p: CatalogProduct) => void;
  onAddToCart: (p: CatalogProduct) => void;
  onBuyNow: (p: CatalogProduct) => void;
}

export default function ProductCard({ product, onOpenDetail, onAddToCart, onBuyNow }: ProductCardProps) {
  const color = getCategoryColor(product.categoryId);
  const hasDiscount = product.effectivePrice < product.price;

  return (
    <article
      className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-stone-200 bg-white transition-all hover:border-stone-300 hover:shadow-md"
      onClick={() => onOpenDetail(product)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetail(product); } }}
      tabIndex={0}
      role="button"
      aria-label={`Lihat detail ${product.name}`}
    >
      <div className="relative aspect-[3/4] flex items-center justify-center bg-stone-100/70">
        <Image
          src={product.image || '/drwprime-product.webp'}
          alt={product.name}
          width={240}
          height={320}
          className="relative z-10 object-contain w-auto h-[80%] transition-transform duration-300 group-hover:scale-105"
        />
        <span
          className="absolute top-3 left-3 z-20 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}
        >
          {product.category}
        </span>
        {hasDiscount && (
          <span className="absolute top-3 right-3 z-20 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
            -{Math.round(((product.price - product.effectivePrice) / product.price) * 100)}%
          </span>
        )}
        {product.promotion?.badgeText && (
          <span className="absolute bottom-3 left-3 z-20 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
            {product.promotion.badgeText}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-[13px] sm:text-sm leading-tight mb-1 line-clamp-2 text-stone-800 group-hover:text-stone-900 transition-colors">
          {product.name}
        </h3>
        {product.size && <p className="text-[10px] sm:text-xs mb-1 text-stone-400 line-clamp-1">{product.size}</p>}
        <p className="mb-3 line-clamp-2 text-[10px] leading-relaxed text-stone-500 sm:text-xs">{product.headline}</p>

        <div className="mt-auto flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            {hasDiscount && (
              <p className="text-[10px] sm:text-xs line-through text-stone-400">{formatPrice(product.price)}</p>
            )}
            <p className="whitespace-nowrap text-[13px] font-bold leading-tight tabular-nums sm:text-base" style={{ color }}>
              {formatPrice(product.effectivePrice)}
            </p>
          </div>
          <div className="grid w-full grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-1 sm:flex sm:w-auto sm:shrink-0">
            <button
              onClick={e => { e.stopPropagation(); onAddToCart(product); }}
              className="flex h-9 w-9 items-center justify-center rounded-lg font-bold text-white transition-all active:scale-90 sm:h-10 sm:w-10"
              style={{ background: color, opacity: 0.8 }}
              aria-label={`Tambah ${product.name} ke keranjang`}
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
            </button>
            <button
              onClick={e => { e.stopPropagation(); onBuyNow(product); }}
              className="flex h-9 min-w-0 items-center justify-center rounded-lg px-2 text-[11px] font-semibold text-white transition-all active:scale-90 sm:h-10 sm:px-3 sm:text-xs"
              style={{ background: color }}
              aria-label={`Beli ${product.name} sekarang`}
            >
              Beli
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
