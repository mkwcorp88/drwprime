'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MobileLayout from '@/components/MobileLayout';
import { products, categories, type CategoryId, type Product } from '@/data/products';

const categoryColors: Record<CategoryId | 'all', string> = {
  all: '#D4AF37',
  acne: '#0D9488',
  lumiera: '#C2185B',
  antiaging: '#C9A84C',
  premium: '#B8860B',
};

const categoryBG: Record<CategoryId | 'all', string> = {
  all: 'rgba(212,175,55,0.15)',
  acne: 'rgba(13,148,136,0.12)',
  lumiera: 'rgba(194,24,91,0.10)',
  antiaging: 'rgba(201,168,76,0.12)',
  premium: 'rgba(184,134,11,0.12)',
};

interface CartItem { product: Product; quantity: number }

export default function ProductGalleryPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryId | 'all'>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailQuantity, setDetailQuantity] = useState(1);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingProvince, setShippingProvince] = useState('');
  const [shippingPostal, setShippingPostal] = useState('');
  const [notes, setNotes] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');

  const filtered = useMemo(() => {
    let result = products;
    if (activeCategory !== 'all') result = result.filter(p => p.categoryId === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.headline.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.manfaat.some(m => m.toLowerCase().includes(q))
      );
    }
    return result;
  }, [activeCategory, search]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(price);

  const cartTotal = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const addToCart = (product: Product, qty = 1) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + qty } : i);
      return [...prev, { product, quantity: qty }];
    });
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.product.id !== id));
  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(i => i.product.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter(i => i.quantity > 0));
  };

  const openDetail = (product: Product) => { setSelectedProduct(product); setDetailQuantity(1); setDetailOpen(true); };
  const closeDetail = () => { setDetailOpen(false); setTimeout(() => setSelectedProduct(null), 200); };

  const handleCheckout = async () => {
    if (!customerName.trim() || !customerPhone.trim()) { setCheckoutError('Nama dan nomor WhatsApp wajib diisi'); return; }
    if (!shippingAddress.trim() || !shippingCity.trim() || !shippingProvince.trim()) { setCheckoutError('Alamat pengiriman wajib diisi'); return; }
    if (cart.length === 0) { setCheckoutError('Keranjang masih kosong'); return; }
    setCheckoutLoading(true); setCheckoutError('');
    try {
      const res = await fetch('/api/products/doku/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(i => ({ name: i.product.name, price: i.product.price, quantity: i.quantity, size: i.product.size, image: i.product.image })),
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim() || undefined,
          shippingAddress: shippingAddress.trim(),
          shippingCity: shippingCity.trim(),
          shippingProvince: shippingProvince.trim(),
          shippingPostal: shippingPostal.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memproses pembayaran');
      setPaymentUrl(data.paymentUrl);
      setCheckoutSuccess(true);
      setCart([]);
    } catch (e) { setCheckoutError(e instanceof Error ? e.message : 'Gagal memproses pembayaran'); }
    finally { setCheckoutLoading(false); }
  };

  const resetCheckout = () => {
    setCartOpen(false); setCheckoutSuccess(false); setCheckoutError(''); setPaymentUrl('');
  };

  return (
    <MobileLayout>
      <Navbar />
      <main style={{ background: 'linear-gradient(180deg, #0B0B0C 0%, #0B0B0C 240px, #F7F3EB 240px, #F7F3EB 100%)', minHeight: '100vh' }} className="pt-24 pb-16">
        {/* Header */}
        <section className="px-5 pb-8 text-center">
          <h1 className="text-[length:var(--h1,2.75rem)] md:text-6xl font-bold mb-2" style={{ color: '#D4AF37' }}>Our Products</h1>
          <p className="text-white/60 text-lg mb-8">Skincare premium diformulasikan untuk setiap jenis kulit</p>

          <div className="max-w-xl mx-auto relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari produk, manfaat, atau series..."
              className="w-full pl-12 pr-5 py-4 rounded-2xl bg-white/10 border border-white/10 text-white placeholder-white/35 focus:border-[#D4AF37]/50 focus:outline-none text-base"
            />
          </div>

          <div className="flex justify-center gap-3 mt-6 flex-wrap">
            {[{ label: 'Produk Resmi', icon: '✓' }, { label: 'Pembayaran Aman', icon: '🔒' }, { label: 'Pengiriman Nasional', icon: '🚚' }].map(b => (
              <span key={b.label} className="text-white/50 text-xs flex items-center gap-1">{b.icon} {b.label}</span>
            ))}
          </div>
        </section>

        {/* Categories */}
        <section className="px-5 mb-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
              {categories.map(c => {
                const active = activeCategory === c.id;
                const color = categoryColors[c.id];
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveCategory(c.id)}
                    className="shrink-0 px-5 py-2.5 rounded-full font-semibold text-sm transition-all whitespace-nowrap"
                    style={{
                      background: active ? color : 'rgba(255,255,255,0.08)',
                      color: active ? '#fff' : 'rgba(255,255,255,0.6)',
                      border: active ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Result count */}
        <section className="px-5 mb-5">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <p className="text-sm" style={{ color: '#6B5E4E' }}>{filtered.length} produk</p>
            <p className="text-sm" style={{ color: '#6B5E4E' }}>
              {activeCategory !== 'all' ? categories.find(c => c.id === activeCategory)?.name : 'Semua Series'}
            </p>
          </div>
        </section>

        {/* Product Grid */}
        <section className="px-5">
          <div className="max-w-7xl mx-auto">
            {filtered.length === 0 && (
              <div className="text-center py-20">
                <p className="text-lg font-semibold" style={{ color: '#6B5E4E' }}>Produk tidak ditemukan</p>
                <p className="text-sm mt-1" style={{ color: '#A89984' }}>Coba kata kunci atau kategori lain</p>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {filtered.map(product => {
                const color = categoryColors[product.categoryId] || categoryColors.all;
                const bg = categoryBG[product.categoryId] || categoryBG.all;
                return (
                  <div key={product.id} className="bg-white rounded-2xl overflow-hidden border border-black/5 hover:shadow-xl transition-shadow duration-300 group cursor-pointer" onClick={() => openDetail(product)}>
                    <div className="relative aspect-[4/5] flex items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #FAF8F5, #F0ECE4)' }}>
                      <Image src={product.image} alt={product.name} width={200} height={250} className="object-contain transition-transform duration-300 group-hover:scale-105 max-h-full" />
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: bg, color: color }}>
                        {product.category}
                      </span>
                    </div>
                    <div className="p-4" onClick={e => e.stopPropagation()}>
                      <h3 className="font-bold text-sm leading-tight mb-1 line-clamp-2" style={{ color: '#1A1A1A' }}>{product.name}</h3>
                      <p className="text-xs mb-2 line-clamp-1" style={{ color: '#9E8A76' }}>{product.size}</p>
                      <p className="text-xs line-clamp-2 mb-3 leading-relaxed" style={{ color: '#6B5E4E' }}>{product.headline}</p>
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-base" style={{ color: color }}>{formatPrice(product.price)}</p>
                        <div className="flex items-center gap-1">
                          <button onClick={e => { e.stopPropagation(); addToCart(product); }}
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-lg transition-transform active:scale-95"
                            style={{ background: color }}
                          >+</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Mobile Cart Bar */}
        {cart.length > 0 && !cartOpen && (
          <div className="lg:hidden fixed bottom-20 left-3 right-3 z-50">
            <button onClick={() => { setCartOpen(true); setCheckoutSuccess(false); setCheckoutError(''); setPaymentUrl(''); }}
              className="w-full py-4 px-5 rounded-2xl font-bold text-base flex items-center justify-between shadow-2xl"
              style={{ background: '#D4AF37', color: '#0B0B0C' }}
            >
              <span>{cartCount} produk &middot; {formatPrice(cartTotal)}</span>
              <span>Lihat Keranjang →</span>
            </button>
          </div>
        )}

        {/* Desktop Cart FAB */}
        {!cartOpen && (
          <button onClick={() => { setCartOpen(true); setCheckoutSuccess(false); setCheckoutError(''); setPaymentUrl(''); }}
            className="hidden lg:flex fixed bottom-10 right-10 w-16 h-16 rounded-full items-center justify-center shadow-2xl z-50 transition-transform hover:scale-110"
            style={{ background: '#D4AF37' }}
          >
            <svg className="w-7 h-7" style={{ color: '#0B0B0C' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">{cartCount}</span>
            )}
          </button>
        )}
      </main>
      <Footer />

      {/* Detail Bottom Sheet / Modal */}
      {detailOpen && selectedProduct && (
        <div className="fixed inset-0 z-[70]" onClick={closeDetail}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="absolute bottom-0 left-0 right-0 lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:max-w-2xl lg:w-full" onClick={e => e.stopPropagation()}>
            <div className="bg-white rounded-t-3xl lg:rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="p-5 lg:p-8">
                <div className="flex justify-end mb-2 lg:hidden">
                  <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto" />
                </div>
                <div className="grid lg:grid-cols-2 gap-6">
                  <div className="flex items-center justify-center rounded-xl p-6" style={{ background: '#FAF8F5' }}>
                    <Image src={selectedProduct.image} alt={selectedProduct.name} width={280} height={350} className="object-contain" />
                  </div>
                  <div>
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-3"
                      style={{ background: categoryBG[selectedProduct.categoryId], color: categoryColors[selectedProduct.categoryId] }}>
                      {selectedProduct.category}
                    </span>
                    <h2 className="text-2xl font-bold mb-1" style={{ color: '#1A1A1A' }}>{selectedProduct.name}</h2>
                    <p className="text-sm mb-1" style={{ color: '#9E8A76' }}>{selectedProduct.size}</p>
                    <p className="text-lg italic mb-4" style={{ color: '#6B5E4E' }}>{selectedProduct.headline}</p>
                    <p className="text-sm leading-relaxed mb-4" style={{ color: '#4A3F35' }}>{selectedProduct.description}</p>

                    <div className="mb-3">
                      <p className="text-xs font-semibold uppercase mb-1" style={{ color: '#9E8A76' }}>Manfaat</p>
                      <ul className="space-y-1">
                        {selectedProduct.manfaat.map((m, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#4A3F35' }}>
                            <span style={{ color: categoryColors[selectedProduct.categoryId] }}>&#x2022;</span> {m}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mb-3">
                      <p className="text-xs font-semibold uppercase mb-1" style={{ color: '#9E8A76' }}>Cara Pakai</p>
                      <p className="text-sm" style={{ color: '#4A3F35' }}>{selectedProduct.caraPakai}</p>
                    </div>

                    <div className="flex items-end justify-between mt-6 pt-4 border-t border-gray-100">
                      <div>
                        <p className="text-xs" style={{ color: '#9E8A76' }}>Harga</p>
                        <p className="text-2xl font-bold" style={{ color: categoryColors[selectedProduct.categoryId] }}>{formatPrice(selectedProduct.price)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setDetailQuantity(q => Math.max(1, q - 1))}
                            className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 font-semibold"
                          >-</button>
                          <span className="w-6 text-center font-semibold text-sm">{detailQuantity}</span>
                          <button onClick={() => setDetailQuantity(q => q + 1)}
                            className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 font-semibold"
                          >+</button>
                        </div>
                        <button onClick={() => { addToCart(selectedProduct, detailQuantity); closeDetail(); }}
                          className="px-6 py-2.5 rounded-full font-bold text-sm text-white transition-transform active:scale-95"
                          style={{ background: categoryColors[selectedProduct.categoryId] }}
                        >+ Keranjang</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-[80]" onClick={resetCheckout}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="absolute right-0 top-0 h-full w-full max-w-md flex flex-col shadow-2xl" style={{ background: '#fff' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: '#1A1A1A' }}>
                <svg className="w-6 h-6" style={{ color: '#D4AF37' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
                Keranjang {cartCount > 0 && <span className="text-sm text-gray-400">({cartCount})</span>}
              </h2>
              <button onClick={resetCheckout} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {checkoutSuccess ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(212,175,55,0.15)' }}>
                    <svg className="w-8 h-8" style={{ color: '#D4AF37' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h3 className="font-bold text-xl mb-2" style={{ color: '#1A1A1A' }}>Pesanan Dibuat!</h3>
                  <p className="text-gray-500 mb-6 text-sm">Kamu akan diarahkan ke halaman pembayaran.</p>
                  {paymentUrl && (
                    <a href={paymentUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-block px-8 py-3 rounded-full font-bold text-sm text-white transition-all hover:shadow-xl"
                      style={{ background: '#D4AF37' }}
                    >Bayar Sekarang via DOKU</a>
                  )}
                </div>
              ) : cart.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                  </svg>
                  <p className="text-gray-400 text-sm">Keranjang masih kosong</p>
                </div>
              ) : (
                <>
                  {cart.map(item => (
                    <div key={item.product.id} className="flex gap-4 py-4 border-b border-gray-50 last:border-0">
                      <div className="w-16 h-20 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#FAF8F5' }}>
                        <Image src={item.product.image} alt={item.product.name} width={48} height={64} className="object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm line-clamp-2" style={{ color: '#1A1A1A' }}>{item.product.name}</h4>
                        <p className="text-xs mt-0.5" style={{ color: '#9E8A76' }}>{item.product.size}</p>
                        <p className="font-bold text-sm mt-0.5" style={{ color: categoryColors[item.product.categoryId] || '#D4AF37' }}>{formatPrice(item.product.price)}</p>
                      </div>
                      <div className="flex flex-col items-end justify-between">
                        <button onClick={() => removeFromCart(item.product.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => updateQuantity(item.product.id, -1)}
                            className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 text-sm font-semibold">-</button>
                          <span className="w-5 text-center text-sm font-semibold" style={{ color: '#1A1A1A' }}>{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.product.id, 1)}
                            className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 text-sm font-semibold">+</button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="mt-6 space-y-4">
                    <h3 className="font-bold text-base" style={{ color: '#1A1A1A' }}>Data Penerima</h3>
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: '#6B5E4E' }}>Nama *</label>
                      <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nama lengkap"
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-[#D4AF37]/50 focus:outline-none" style={{ color: '#1A1A1A' }} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: '#6B5E4E' }}>WhatsApp *</label>
                      <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="081234567890"
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-[#D4AF37]/50 focus:outline-none" style={{ color: '#1A1A1A' }} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: '#6B5E4E' }}>Email</label>
                      <input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="email@contoh.com"
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-[#D4AF37]/50 focus:outline-none" style={{ color: '#1A1A1A' }} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: '#6B5E4E' }}>Alamat Lengkap *</label>
                      <textarea value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} placeholder="Jalan, nomor, RT/RW, patokan..." rows={2}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-[#D4AF37]/50 focus:outline-none resize-none" style={{ color: '#1A1A1A' }} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: '#6B5E4E' }}>Kota/Kab *</label>
                        <input type="text" value={shippingCity} onChange={e => setShippingCity(e.target.value)} placeholder="Kota"
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-[#D4AF37]/50 focus:outline-none" style={{ color: '#1A1A1A' }} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: '#6B5E4E' }}>Kode Pos</label>
                        <input type="text" value={shippingPostal} onChange={e => setShippingPostal(e.target.value)} placeholder="12345"
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-[#D4AF37]/50 focus:outline-none" style={{ color: '#1A1A1A' }} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: '#6B5E4E' }}>Provinsi *</label>
                      <input type="text" value={shippingProvince} onChange={e => setShippingProvince(e.target.value)} placeholder="Provinsi"
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-[#D4AF37]/50 focus:outline-none" style={{ color: '#1A1A1A' }} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: '#6B5E4E' }}>Catatan</label>
                      <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Catatan kurir / patokan..." rows={2}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-[#D4AF37]/50 focus:outline-none resize-none" style={{ color: '#1A1A1A' }} />
                    </div>
                  </div>
                </>
              )}
            </div>

            {cart.length > 0 && !checkoutSuccess && (
              <div className="border-t border-gray-100 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold" style={{ color: '#6B5E4E' }}>Total</span>
                  <span className="font-bold text-2xl" style={{ color: '#D4AF37' }}>{formatPrice(cartTotal)}</span>
                </div>
                {checkoutError && <p className="text-red-500 text-sm text-center">{checkoutError}</p>}
                <button onClick={handleCheckout} disabled={checkoutLoading}
                  className="w-full py-4 rounded-full font-bold text-base transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: '#D4AF37', color: '#0B0B0C' }}
                >
                  {checkoutLoading ? (
                    <><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg> Memproses...</>
                  ) : (
                    <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg> Lanjut ke Pembayaran</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </MobileLayout>
  );
}
