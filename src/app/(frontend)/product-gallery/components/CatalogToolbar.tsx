'use client';

import Image from 'next/image';
import { getCategoryColor } from '@/features/product-commerce/category-theme';
import { CLASSIFICATION_LIST, CLASSIFICATION_LABELS } from '@/features/product-commerce/types';
import type { CatalogCategory } from '@/features/product-commerce/types';

const CLASS_ICONS: Record<string, string> = {
  acne: '/product-classifications/acne.webp',
  brightening: '/product-classifications/brightening.webp',
  antiaging: '/product-classifications/antiaging.webp',
};

const CLASS_ORDER: (string | null)[] = [null, 'acne', 'brightening', 'antiaging'];

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
  const displayCategories = [{ id: 'all', name: 'Semua Tipe' }, ...categories.map(c => ({ id: c.id, name: c.name }))];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="relative w-full">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Cari produk, manfaat, atau series..."
          className="w-full pl-12 pr-10 py-3.5 rounded-xl bg-white border border-stone-200 text-stone-800 placeholder-stone-400 focus:border-stone-400 focus:outline-none focus:ring-4 focus:ring-stone-100 text-sm transition-all shadow-sm"
          autoComplete="off"
        />
        {search && (
          <button onClick={() => onSearchChange('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600" aria-label="Hapus pencarian">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      <div>
        <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-3 text-center">Kebutuhan Kulit</p>
        <div className="flex gap-4 justify-start sm:justify-center overflow-x-auto pb-2 scrollbar-hide px-2" style={{ WebkitOverflowScrolling: 'touch' }}>
          {CLASS_ORDER.map((c) => {
            const isAll = c === null;
            const active = isAll ? activeClassification === 'all' : activeClassification === c;
            const color = isAll ? '#B8860B' : getCategoryColor(c);
            return (
              <button
                key={isAll ? 'all' : c}
                onClick={() => onClassificationChange(isAll ? 'all' : c!)}
                className={`shrink-0 flex flex-col items-center gap-2 transition-all ${active ? '-translate-y-1' : 'opacity-80 hover:opacity-100 hover:-translate-y-0.5'}`}
                aria-pressed={active}
              >
                <div
                  className="w-16 h-16 lg:w-20 lg:h-20 rounded-[1.25rem] flex items-center justify-center overflow-hidden transition-all shadow-sm"
                  style={{
                    background: isAll ? (active ? `${color}15` : '#f8f8f8') : 'transparent',
                    boxShadow: active ? `0 0 0 2px ${color}, 0 4px 12px ${color}25` : '0 2px 8px rgba(0,0,0,0.04)',
                  }}
                >
                  {isAll ? (
                    <svg className="w-8 h-8 lg:w-10 lg:h-10" style={{ color: active ? color : '#a8a29e' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  ) : (
                    <Image src={CLASS_ICONS[c]} alt={CLASSIFICATION_LABELS[c as keyof typeof CLASSIFICATION_LABELS]} width={80} height={80} className="w-full h-full object-cover" />
                  )}
                </div>
                <span className={`text-[11px] lg:text-xs font-semibold whitespace-nowrap ${active ? 'text-stone-800' : 'text-stone-500'}`}>
                  {isAll ? 'Semua' : CLASSIFICATION_LABELS[c as keyof typeof CLASSIFICATION_LABELS]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-2">
        <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-3 text-center">Tipe Produk</p>
        <div className="flex gap-2 justify-start sm:justify-center overflow-x-auto pb-1 scrollbar-hide px-2" style={{ WebkitOverflowScrolling: 'touch' }}>
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
    </div>
  );
}
