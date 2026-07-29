'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import type { CatalogProduct } from '@/features/product-commerce/types';
import { getCategoryColor, getCategoryBG } from '@/features/product-commerce/category-theme';
import { formatPrice } from '@/features/product-commerce/formatters';

interface ProductDetailDialogProps {
  product: CatalogProduct;
  open: boolean;
  onClose: () => void;
  onAddToCart: (p: CatalogProduct, qty: number) => void;
}

export default function ProductDetailDialog({ product, open, onClose, onAddToCart }: ProductDetailDialogProps) {
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
    <div className="fixed inset-0 z-[70]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div className="absolute inset-x-0 bottom-0 lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:max-w-2xl lg:w-full lg:max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Detail ${product.name}`}
          tabIndex={-1}
          className="bg-[#0D0D10] rounded-t-3xl lg:rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-white/[0.08] outline-none"
        >
          <div className="sticky top-0 flex justify-between items-center p-4 z-10 bg-[#0D0D10]/95 backdrop-blur">
            <div className="w-12 h-1 rounded-full bg-white/15 mx-auto lg:hidden" />
            <button
              onClick={onClose}
              className="hidden lg:flex w-8 h-8 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 ml-auto"
              aria-label="Tutup"
            >
              <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-5 lg:p-8 pt-0 lg:pt-4">
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="flex items-center justify-center rounded-2xl bg-[#0A0A0C] p-6 relative">
                <div className="absolute inset-0 rounded-2xl opacity-20" style={{ background: `radial-gradient(circle at 50% 30%, ${color}44, transparent 70%)` }} />
                <Image
                  src={product.image || '/drwprime-product.webp'}
                  alt={product.name}
                  width={280}
                  height={350}
                  className="relative z-10 object-contain w-auto max-h-[300px]"
                />
              </div>

              <div>
                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3 border" style={{ background: getCategoryBG(product.categoryId), color, borderColor: `${color}30` }}>
                  {product.category}
                </span>
                <h2 className="text-xl lg:text-2xl font-bold mb-1 text-white">{product.name}</h2>
                {product.size && <p className="text-sm mb-1 text-white/40">{product.size}</p>}
                <p className="text-sm italic mb-4 text-white/50">{product.headline}</p>
                <p className="text-sm leading-relaxed mb-5 text-white/65">{product.description}</p>

                {product.benefits.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[10px] font-semibold uppercase mb-2 tracking-widest text-white/30">Manfaat</p>
                    <div className="flex flex-wrap gap-1.5">
                      {product.benefits.map((m, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg text-[11px] leading-relaxed border" style={{ background: `${color}10`, color: `${color}ee`, borderColor: `${color}20` }}>
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {product.caraPakai && (
                  <div className="mb-5">
                    <p className="text-[10px] font-semibold uppercase mb-1.5 tracking-widest text-white/30">Cara Pakai</p>
                    <p className="text-sm text-white/55">{product.caraPakai}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 mt-6 pt-5 border-t border-white/[0.06] bg-[#0D0D10]">
              <div className="flex flex-col min-[400px]:flex-row items-stretch min-[400px]:items-center gap-4">
                <div className="flex-1">
                  {product.effectivePrice < product.price && (
                    <p className="text-xs line-through text-white/25">{formatPrice(product.price)}</p>
                  )}
                  <p className="text-xl lg:text-2xl font-bold" style={{ color }}>{formatPrice(product.effectivePrice)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-white/5 rounded-xl border border-white/10 p-1">
                    <button
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white/60 font-semibold text-lg hover:bg-white/10 transition-colors"
                      aria-label="Kurangi quantity"
                    >-</button>
                    <span className="w-8 text-center font-semibold text-sm text-white">{quantity}</span>
                    <button
                      onClick={() => setQuantity(q => q + 1)}
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white/60 font-semibold text-lg hover:bg-white/10 transition-colors"
                      aria-label="Tambah quantity"
                    >+</button>
                  </div>
                  <button
                    onClick={() => { onAddToCart(product, quantity); onClose(); }}
                    className="flex-1 min-[400px]:flex-none px-6 py-3.5 rounded-xl font-bold text-sm text-black transition-all active:scale-95 flex items-center justify-center gap-2"
                    style={{ background: color }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                    </svg>
                    + Keranjang
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
