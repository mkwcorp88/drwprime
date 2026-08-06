'use client';

import { useState, useMemo, useReducer, useCallback } from 'react';
import type { CatalogProduct, CatalogCategory, CheckoutForm, PendingOrder } from '@/features/product-commerce/types';
import { CLASSIFICATION_LABELS } from '@/features/product-commerce/types';
import { cartReducer } from '@/features/product-commerce/cart-reducer';

import CatalogToolbar from './CatalogToolbar';
import ProductGrid from './ProductGrid';
import ProductDetailDialog from './ProductDetailDialog';
import CartDock from './CartDock';
import CartDrawer from './CartDrawer';
import ProductGalleryBannerSlider, { type GalleryBanner } from './ProductGalleryBannerSlider';
import { GallerySkeleton, GalleryError } from './GalleryState';

interface ProductGalleryClientProps {
  initialProducts: CatalogProduct[];
  initialCategories: CatalogCategory[];
  banners: GalleryBanner[];
}

export default function ProductGalleryClient({ initialProducts, initialCategories, banners }: ProductGalleryClientProps) {
  const [products] = useState<CatalogProduct[]>(initialProducts);
  const [categories] = useState<CatalogCategory[]>(initialCategories);
  const [loading] = useState(false);
  const [loadError] = useState('');

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeClassification, setActiveClassification] = useState<string>('all');

  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [cart, dispatch] = useReducer(cartReducer, []);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartMode, setCartMode] = useState<'cart' | 'buy_now'>('cart');

  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);

  const filtered = useMemo(() => {
    let result = products;
    if (activeClassification !== 'all') result = result.filter(p => p.classification === activeClassification);
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
  }, [activeClassification, activeCategory, search, products]);

  const openDetail = useCallback((p: CatalogProduct) => { setSelectedProduct(p); setDetailOpen(true); }, []);
  const closeDetail = useCallback(() => setDetailOpen(false), []);

  const addToCart = useCallback((p: CatalogProduct, qty = 1) => {
    dispatch({ type: 'ADD_ITEM', product: p, quantity: qty });
  }, []);
  const removeFromCart = useCallback((id: string) => dispatch({ type: 'REMOVE_ITEM', id }), []);
  const updateQuantity = useCallback((id: string, delta: number) => dispatch({ type: 'UPDATE_QUANTITY', id, delta }), []);

  const buyNow = useCallback((p: CatalogProduct, qty = 1) => {
    dispatch({ type: 'CLEAR' });
    dispatch({ type: 'ADD_ITEM', product: p, quantity: qty });
    setCartMode('buy_now');
    setCartOpen(true);
  }, []);

  const openCart = useCallback(() => {
    if (cart.length > 0) {
      setCartMode('cart');
      setCartOpen(true);
    }
  }, [cart.length]);

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
    <div className="min-h-screen bg-stone-50">
      {/* Hero / Banner Slider */}
      <ProductGalleryBannerSlider banners={banners} />

      {/* Premium Header Identity */}
      <section className="pt-8 pb-2 px-5">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-[11px] uppercase tracking-[0.25em] text-stone-400 font-semibold mb-2">DRW PRIME SKINCARE</p>
          <h1 className="text-2xl lg:text-4xl font-bold text-stone-800 mb-2 tracking-tight">Etalase Perawatan Kulit</h1>
          <p className="text-sm text-stone-500 max-w-lg mx-auto">Temukan rangkaian Acne, Brightening, dan Anti Aging sesuai kebutuhan kulitmu.</p>
          <div className="flex flex-wrap items-center justify-center gap-4 lg:gap-8 mt-5 text-[11px] text-stone-400">
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Produk Original
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              Pembayaran Aman
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Informasi Produk Lengkap
            </span>
          </div>
        </div>
      </section>

      <section className="px-5 pb-6">
        <div className="max-w-7xl mx-auto">
          <CatalogToolbar
            search={search}
            onSearchChange={setSearch}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            activeClassification={activeClassification}
            onClassificationChange={setActiveClassification}
            categories={categories}
          />
        </div>
      </section>

      <section className="px-5 pb-32 lg:pb-20">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <p className="text-xs text-stone-400 font-medium">{filtered.length} produk</p>
            <p className="text-xs text-stone-400">
              {activeClassification !== 'all'
                ? CLASSIFICATION_LABELS[activeClassification as keyof typeof CLASSIFICATION_LABELS] || activeClassification
                : activeCategory !== 'all' ? activeCategory : 'Semua Series'}
            </p>
          </div>

          <ProductGrid
            products={filtered}
            onOpenDetail={openDetail}
            onAddToCart={addToCart}
            onBuyNow={buyNow}
            emptyMessage={search ? 'Tidak ada produk yang cocok dengan pencarian' : undefined}
          />
        </div>
      </section>

      {!cartOpen && cart.length > 0 && cartMode === 'cart' && (
        <button
          onClick={openCart}
          className="hidden lg:flex fixed bottom-10 right-10 w-14 h-14 rounded-2xl items-center justify-center shadow-lg z-50 transition-all hover:scale-105 active:scale-95 hover:shadow-xl"
          style={{ background: '#D4AF37' }}
          aria-label="Buka keranjang"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
          </svg>
          <span className="absolute -top-1 -right-1 bg-stone-800 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {cart.reduce((s, i) => s + i.quantity, 0)}
          </span>
        </button>
      )}

      {!cartOpen && <CartDock cart={cart} onOpenCart={openCart} />}

      <ProductDetailDialog
        product={selectedProduct!}
        open={detailOpen}
        onClose={closeDetail}
        onAddToCart={addToCart}
        onBuyNow={buyNow}
      />

      <CartDrawer
        open={cartOpen}
        cart={cart}
        mode={cartMode}
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
