'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import type { CatalogProduct } from '@/features/product-commerce/types';
import { getCategoryColor } from '@/features/product-commerce/category-theme';
import { formatPrice } from '@/features/product-commerce/formatters';

interface ProductDetailDialogProps {
  product: CatalogProduct;
  open: boolean;
  onClose: () => void;
  onAddToCart: (p: CatalogProduct, qty: number) => void;
  onBuyNow: (p: CatalogProduct, qty: number) => void;
}

export default function ProductDetailDialog({ product, open, onClose, onAddToCart, onBuyNow }: ProductDetailDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement as HTMLElement;
      setQuantity(1);
      document.body.style.overflow = 'hidden';
      setTimeout(() => dialogRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = '';
      previousFocus.current?.focus();
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'Tab' && dialogRef.current) {
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  }, [onClose]);

  useEffect(() => {
    if (open) { document.addEventListener('keydown', handleKeyDown); return () => document.removeEventListener('keydown', handleKeyDown); }
  }, [open, handleKeyDown]);

  if (!open) return null;

  const color = getCategoryColor(product.categoryId);

  return (
    <div className="fixed inset-0 z-[70] flex items-end lg:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full lg:max-w-2xl lg:max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Detail ${product.name}`}
          tabIndex={-1}
          className="bg-white rounded-t-3xl lg:rounded-2xl max-h-[90vh] overflow-y-auto shadow-xl outline-none"
        >
          <div className="sticky top-0 flex justify-between items-center p-4 z-10 bg-white/95 backdrop-blur">
            <div className="w-10 h-1 rounded-full bg-stone-300 mx-auto lg:hidden" />
            <button
              onClick={onClose}
              className="hidden lg:flex w-8 h-8 items-center justify-center rounded-full bg-stone-100 hover:bg-stone-200 ml-auto transition-colors"
              aria-label="Tutup"
            >
              <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-5 lg:p-8 pt-0 lg:pt-4">
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="flex items-center justify-center rounded-2xl bg-stone-50 p-6">
                <Image
                  src={product.image || '/drwprime-product.webp'}
                  alt={product.name}
                  width={280}
                  height={350}
                  className="object-contain w-auto max-h-[280px]"
                />
              </div>

              <div>
                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide mb-3" style={{ background: `${color}12`, color, border: `1px solid ${color}25` }}>
                  {product.category}
                </span>
                <h2 className="text-xl lg:text-2xl font-bold mb-1 text-stone-900">{product.name}</h2>
                {product.size && <p className="text-sm mb-1 text-stone-400">{product.size}</p>}
                <p className="text-sm mb-4 text-stone-500">{product.headline}</p>
                <p className="text-sm leading-relaxed mb-5 text-stone-600">{product.description}</p>

                {product.benefits.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[10px] font-semibold uppercase mb-2 tracking-wide text-stone-400">Manfaat</p>
                    <div className="flex flex-wrap gap-1.5">
                      {product.benefits.map((m, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg text-[11px] leading-relaxed" style={{ background: `${color}10`, color }}>
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {product.caraPakai && (
                  <div className="mb-5">
                    <p className="text-[10px] font-semibold uppercase mb-1.5 tracking-wide text-stone-400">Cara Pakai</p>
                    <p className="text-sm text-stone-500">{product.caraPakai}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 mt-6 pt-5 border-t border-stone-100 bg-white">
              <div className="flex flex-col min-[400px]:flex-row items-stretch min-[400px]:items-center gap-4">
                <div className="flex-1">
                  {product.effectivePrice < product.price && (
                    <p className="text-xs line-through text-stone-400">{formatPrice(product.price)}</p>
                  )}
                  <p className="text-xl lg:text-2xl font-bold" style={{ color }}>{formatPrice(product.effectivePrice)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-1">
                    <button
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      className="w-9 h-9 rounded-md flex items-center justify-center text-stone-500 font-semibold hover:bg-stone-200 transition-colors"
                      aria-label="Kurangi quantity"
                    >-</button>
                    <span className="w-7 text-center font-semibold text-sm text-stone-800">{quantity}</span>
                    <button
                      onClick={() => setQuantity(q => q + 1)}
                      className="w-9 h-9 rounded-md flex items-center justify-center text-stone-500 font-semibold hover:bg-stone-200 transition-colors"
                      aria-label="Tambah quantity"
                    >+</button>
                  </div>
                  <button
                    onClick={() => { onAddToCart(product, quantity); onClose(); }}
                    className="px-4 py-3 rounded-xl font-semibold text-sm text-white transition-all active:scale-95 flex items-center justify-center gap-1.5"
                    style={{ background: color, opacity: 0.8 }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                    </svg>
                    Keranjang
                  </button>
                  <button
                    onClick={() => { onBuyNow(product, quantity); onClose(); }}
                    className="flex-1 min-[400px]:flex-none px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all active:scale-95 flex items-center justify-center gap-2"
                    style={{ background: color }}
                  >
                    Beli Sekarang
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
