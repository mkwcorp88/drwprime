'use client';

import { useState, useMemo, useReducer, useCallback } from 'react';
import type { CatalogProduct, CatalogCategory, CartItem, CheckoutForm, PendingOrder } from '@/features/product-commerce/types';
import { cartReducer } from '@/features/product-commerce/cart-reducer';

import CatalogToolbar from './CatalogToolbar';
import ProductGrid from './ProductGrid';
import ProductDetailDialog from './ProductDetailDialog';
import CartDock from './CartDock';
import CartDrawer from './CartDrawer';
import { GallerySkeleton, GalleryError } from './GalleryState';
import { formatPrice } from '@/features/product-commerce/formatters';

interface ProductGalleryClientProps {
  initialProducts: CatalogProduct[];
  initialCategories: CatalogCategory[];
}

export default function ProductGalleryClient({ initialProducts, initialCategories }: ProductGalleryClientProps) {
  const [products] = useState<CatalogProduct[]>(initialProducts);
  const [categories] = useState<CatalogCategory[]>(initialCategories);
  const [loading] = useState(false);
  const [loadError] = useState('');

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [cart, dispatch] = useReducer(cartReducer, []);
  const [cartOpen, setCartOpen] = useState(false);

  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);

  const filtered = useMemo(() => {
    let result = products;
    if (activeCategory !== 'all') result = result.filter(p => p.categoryId === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.headline || '').toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.benefits.some(m => m.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [activeCategory, search, products]);

  const openDetail = useCallback((p: CatalogProduct) => { setSelectedProduct(p); setDetailOpen(true); }, []);
  const closeDetail = useCallback(() => setDetailOpen(false), []);

  const addToCart = useCallback((p: CatalogProduct, qty = 1) => {
    dispatch({ type: 'ADD_ITEM', product: p, quantity: qty });
  }, []);
  const removeFromCart = useCallback((id: string) => dispatch({ type: 'REMOVE_ITEM', id }), []);
  const updateQuantity = useCallback((id: string, delta: number) => dispatch({ type: 'UPDATE_QUANTITY', id, delta }), []);

  const handleCheckout = useCallback(async (form: CheckoutForm, idempotencyKey: string): Promise<{ paymentUrl: string; publicToken: string } | null> => {
    const res = await fetch('/api/products/doku/create-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity })),
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        customerEmail: form.customerEmail.trim() || undefined,
        shippingAddress: form.shippingAddress.trim(),
        shippingCity: form.shippingCity.trim(),
        shippingProvince: form.shippingProvince.trim(),
        shippingPostal: form.shippingPostal.trim() || undefined,
        notes: form.notes.trim() || undefined,
        idempotencyKey,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal memproses pembayaran');

    const order = {
      paymentUrl: data.paymentUrl,
      publicToken: data.publicToken || '',
      orderTotal: 0,
      timestamp: Date.now(),
    };

    setPendingOrder(order);
    dispatch({ type: 'CLEAR' });
    return order;
  }, [cart]);

  const clearPendingOrder = useCallback(() => setPendingOrder(null), []);

  if (loading) {
    return <GallerySkeleton />;
  }

  if (loadError) {
    return <GalleryError message={loadError} onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="min-h-screen bg-[#07070A]" style={{ background: 'radial-gradient(ellipse at 50% 0%, #1a1025 0%, #07070A 60%)' }}>
      {/* Hero */}
      <section className="px-5 pt-6 pb-4 text-center">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2 text-primary tracking-tight">Our Products</h1>
        <p className="text-white/45 text-sm sm:text-base mb-6">Skincare premium diformulasikan untuk setiap jenis kulit</p>

        <div className="flex justify-center gap-4 mb-2 flex-wrap">
          {[{ icon: '✓', label: 'Produk Resmi' }, { icon: '🔒', label: 'Pembayaran Aman' }, { icon: '🚚', label: 'Pengiriman Nasional' }].map(b => (
            <span key={b.label} className="text-white/30 text-[10px] sm:text-xs flex items-center gap-1">{b.icon} {b.label}</span>
          ))}
        </div>
      </section>

      <section className="px-5 pb-5">
        <div className="max-w-7xl mx-auto">
          <CatalogToolbar
            search={search}
            onSearchChange={setSearch}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            categories={categories}
            totalProducts={filtered.length}
          />
        </div>
      </section>

      <section className="px-5 pb-32 lg:pb-20">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-white/30 font-medium">{filtered.length} produk</p>
            <p className="text-xs text-white/30">
              {activeCategory !== 'all' ? 'Kategori: ' + activeCategory : 'Semua Series'}
            </p>
          </div>

          <ProductGrid
            products={filtered}
            onOpenDetail={openDetail}
            onAddToCart={addToCart}
            emptyMessage={search ? 'Tidak ada produk yang cocok dengan pencarian' : undefined}
          />
        </div>
      </section>

      {/* Desktop Cart FAB */}
      {!cartOpen && cart.length > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="hidden lg:flex fixed bottom-10 right-10 w-14 h-14 rounded-2xl items-center justify-center shadow-2xl z-50 transition-transform hover:scale-105 active:scale-95"
          style={{ background: '#D4AF37' }}
          aria-label="Buka keranjang"
        >
          <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
          </svg>
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {cart.reduce((s, i) => s + i.quantity, 0)}
          </span>
        </button>
      )}

      <CartDock cart={cart} onOpenCart={() => setCartOpen(true)} />

      <ProductDetailDialog
        product={selectedProduct!}
        open={detailOpen}
        onClose={closeDetail}
        onAddToCart={addToCart}
      />

      <CartDrawer
        open={cartOpen}
        cart={cart}
        onClose={() => setCartOpen(false)}
        onRemoveItem={removeFromCart}
        onUpdateQuantity={updateQuantity}
        onCheckout={handleCheckout}
        pendingOrder={pendingOrder}
        clearPendingOrder={clearPendingOrder}
      />
    </div>
  );
}
