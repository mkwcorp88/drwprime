'use client';

import { formatPrice, cartTotal, cartCount as calcCount } from '@/features/product-commerce/formatters';
import type { CartItem } from '@/features/product-commerce/types';

interface CartDockProps {
  cart: CartItem[];
  onOpenCart: () => void;
}

export default function CartDock({ cart, onOpenCart }: CartDockProps) {
  if (cart.length === 0) return null;

  const total = cartTotal(cart);
  const count = calcCount(cart);

  return (
    <div className="lg:hidden fixed bottom-[calc(5rem+env(safe-area-inset-bottom,1rem))] left-3 right-3 z-50">
      <button
        onClick={onOpenCart}
        className="w-full py-4 px-5 rounded-2xl font-semibold text-base flex items-center justify-between shadow-lg transition-all active:scale-[0.98]"
        style={{ background: '#D4AF37', color: '#fff' }}
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
          </svg>
          <span>{count} item</span>
        </div>
        <span className="tracking-tight">{formatPrice(total)}</span>
      </button>
    </div>
  );
}
