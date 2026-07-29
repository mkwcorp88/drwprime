'use client';

import Image from 'next/image';
import type { CatalogProduct } from '@/features/product-commerce/types';
import { getCategoryColor, getCategoryBG } from '@/features/product-commerce/category-theme';
import { formatPrice } from '@/features/product-commerce/formatters';

interface ProductCardProps {
  product: CatalogProduct;
  onOpenDetail: (p: CatalogProduct) => void;
  onAddToCart: (p: CatalogProduct) => void;
}

export default function ProductCard({ product, onOpenDetail, onAddToCart }: ProductCardProps) {
  const color = getCategoryColor(product.categoryId);
  const bg = getCategoryBG(product.categoryId);
  const hasDiscount = product.effectivePrice < product.price;

  return (
    <article
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/[0.06] bg-black/40 transition-shadow hover:border-white/10 hover:shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
      onClick={() => onOpenDetail(product)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetail(product); } }}
      tabIndex={0}
      role="button"
      aria-label={`Lihat detail ${product.name}`}
    >
      <div className="relative aspect-[3/4] flex items-center justify-center bg-[#0A0A0C]">
        <div className="absolute inset-0 opacity-30" style={{ background: `radial-gradient(circle at 50% 30%, ${color}22, transparent 70%)` }} />
        <Image
          src={product.image || '/drwprime-product.webp'}
          alt={product.name}
          width={240}
          height={320}
          className="relative z-10 object-contain w-auto h-[85%] transition-transform duration-300 group-hover:scale-105"
        />
        <span
          className="absolute top-2.5 left-2.5 z-20 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border"
          style={{ background: bg, color, borderColor: `${color}30` }}
        >
          {product.category}
        </span>
        {hasDiscount && (
          <span className="absolute top-2.5 right-2.5 z-20 rounded-full bg-red-500/90 px-2 py-0.5 text-[10px] font-bold text-white">
            -{Math.round(((product.price - product.effectivePrice) / product.price) * 100)}%
          </span>
        )}
        {product.promotion?.badgeText && (
          <span className="absolute bottom-2.5 left-2.5 z-20 rounded-full bg-amber-500/90 px-2 py-0.5 text-[9px] font-bold text-black">
            {product.promotion.badgeText}
          </span>
        )}
      </div>

      <div className="p-3 sm:p-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-[13px] sm:text-sm leading-tight mb-1 line-clamp-2 text-white/90 group-hover:text-white transition-colors">
          {product.name}
        </h3>
        {product.size && <p className="text-[10px] sm:text-xs mb-1.5 text-white/35 line-clamp-1">{product.size}</p>}
        <p className="text-[10px] sm:text-xs line-clamp-2 mb-2.5 leading-relaxed text-white/45">{product.headline}</p>

        <div className="flex items-end justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            {hasDiscount && (
              <p className="text-[10px] sm:text-xs line-through text-white/25">{formatPrice(product.price)}</p>
            )}
            <p className="font-bold text-[13px] sm:text-base leading-tight truncate" style={{ color }}>{formatPrice(product.effectivePrice)}</p>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onAddToCart(product); }}
            className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg transition-all active:scale-90"
            style={{ background: color }}
            aria-label={`Tambah ${product.name} ke keranjang`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}
