'use client';

import { getCategoryColor } from '@/features/product-commerce/category-theme';
import type { CatalogCategory } from '@/features/product-commerce/types';

interface CatalogToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  activeCategory: string;
  onCategoryChange: (id: string) => void;
  categories: CatalogCategory[];
  totalProducts: number;
}

export default function CatalogToolbar({
  search,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  categories,
  totalProducts,
}: CatalogToolbarProps) {
  const displayCategories = [{ id: 'all', name: 'Semua' }, ...categories.map(c => ({ id: c.id, name: c.name }))];

  return (
    <div className="space-y-4">
      <div className="relative max-w-xl mx-auto">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Cari produk, manfaat, atau series..."
          className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-white/8 border border-white/10 text-white placeholder-white/30 focus:border-primary/50 focus:outline-none focus:bg-white/10 text-sm transition-colors"
          autoComplete="off"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
            aria-label="Hapus pencarian"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
        {displayCategories.map(c => {
          const active = activeCategory === c.id;
          const color = getCategoryColor(c.id as string);
          return (
            <button
              key={c.id}
              onClick={() => onCategoryChange(c.id)}
              className="shrink-0 px-4 py-2 rounded-full font-semibold text-xs sm:text-sm transition-all whitespace-nowrap flex items-center gap-1.5"
              style={{
                background: active ? color : 'rgba(255,255,255,0.06)',
                color: active ? '#0B0B0C' : 'rgba(255,255,255,0.55)',
                border: active ? 'none' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {c.name}
              {c.id !== 'all' && active && (
                <span className="text-[10px] opacity-70">
                  {totalProducts}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
