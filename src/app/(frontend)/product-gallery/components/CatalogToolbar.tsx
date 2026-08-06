'use client';

import { getCategoryColor } from '@/features/product-commerce/category-theme';
import { CLASSIFICATION_LIST, CLASSIFICATION_LABELS } from '@/features/product-commerce/types';
import type { CatalogCategory } from '@/features/product-commerce/types';

interface CatalogToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  activeCategory: string;
  onCategoryChange: (id: string) => void;
  activeClassification: string;
  onClassificationChange: (id: string) => void;
  categories: CatalogCategory[];
}

export default function CatalogToolbar({
  search,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  activeClassification,
  onClassificationChange,
  categories,
}: CatalogToolbarProps) {
  const displayCategories = [{ id: 'all', name: 'Semua Type' }, ...categories.map(c => ({ id: c.id, name: c.name }))];

  return (
    <div className="space-y-4">
      <div className="relative max-w-xl mx-auto">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Cari produk, manfaat, atau series..."
          className="w-full pl-12 pr-10 py-3 rounded-xl bg-white border border-stone-200 text-stone-800 placeholder-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-100 text-sm transition-all"
          autoComplete="off"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            aria-label="Hapus pencarian"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
        <button
          onClick={() => onClassificationChange('all')}
          className="shrink-0 px-4 py-2 rounded-full font-medium text-xs sm:text-sm transition-all whitespace-nowrap"
          style={{
            background: activeClassification === 'all' ? '#B8860B' : 'transparent',
            color: activeClassification === 'all' ? '#fff' : 'rgb(120,113,108)',
            border: activeClassification === 'all' ? '1px solid #B8860B' : '1px solid rgb(214,211,209)',
          }}
        >
          Semua
        </button>
        {CLASSIFICATION_LIST.map(c => {
          const active = activeClassification === c;
          const color = getCategoryColor(c);
          return (
            <button
              key={c}
              onClick={() => onClassificationChange(c)}
              className="shrink-0 px-4 py-2 rounded-full font-medium text-xs sm:text-sm transition-all whitespace-nowrap"
              style={{
                background: active ? color : 'transparent',
                color: active ? '#fff' : 'rgb(120,113,108)',
                border: active ? `1px solid ${color}` : '1px solid rgb(214,211,209)',
              }}
            >
              {CLASSIFICATION_LABELS[c]}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
        {displayCategories.map(c => {
          const active = activeCategory === c.id;
          return (
            <button
              key={c.id}
              onClick={() => onCategoryChange(c.id)}
              className="shrink-0 px-3 py-1.5 rounded-full font-medium text-[11px] sm:text-xs transition-all whitespace-nowrap"
              style={{
                background: active ? 'rgb(231,229,228)' : 'transparent',
                color: active ? 'rgb(68,64,60)' : 'rgb(168,162,158)',
                border: active ? '1px solid rgb(214,211,209)' : '1px solid rgb(231,229,228)',
              }}
            >
              {c.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
