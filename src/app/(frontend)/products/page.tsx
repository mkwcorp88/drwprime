'use client';

import { useState } from 'react';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MobileLayout from '@/components/MobileLayout';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  size: string;
  image: string;
  category: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

const products: Product[] = [
  // Acne Specialized Series
  {
    id: 'acne-cleanser',
    name: 'Specialized Acne Control Cleanser',
    description: 'Pembersih wajah untuk membersihkan kotoran, debu, dan sisa makeup pada wajah. Diformulasikan khusus untuk kulit berjerawat dan berminyak sehingga kulit tampak bersih, bebas jerawat dan minyak berlebih.',
    price: 95000,
    size: '100 ml',
    image: '/products/individual/acne-cleanser.webp',
    category: 'Acne Specialized Series'
  },
  {
    id: 'acne-moisturizer',
    name: 'Specialized Acne Soothing Moisturizer',
    description: 'Diformulasikan khusus untuk wajah berjerawat membantu mengurangi jerawat dan peradangan pada kulit wajah dan membantu melembabkan kulit wajah.',
    price: 125000,
    size: '30 gr',
    image: '/products/individual/acne-moisturizer.webp',
    category: 'Acne Specialized Series'
  },
  {
    id: 'acne-uv-protect',
    name: 'Specialized Acne Shield UV Protect',
    description: 'Membantu melindungi kulit dari sinar matahari langsung yang dapat menyebabkan kerusakan kulit dan membantu merawat kulit wajah yang berjerawat serta membantu membuat kulit lebih cerah dan lembab.',
    price: 120000,
    size: '30 gr',
    image: '/products/individual/acne-uv-protect.webp',
    category: 'Acne Specialized Series'
  },
  {
    id: 'acne-glow-cream',
    name: 'Specialized Acne Glow Bright Cream',
    description: 'Cream yang dapat berfungsi untuk merawat kulit berjerawat, menjaga kelembapan kulit, dan membantu menyamarkan noda noda hitam dikulit wajah.',
    price: 120000,
    size: '20 gr',
    image: '/products/individual/acne-glow-cream.webp',
    category: 'Acne Specialized Series'
  },
  // Lumièra Series
  {
    id: 'lumiera-cleanser',
    name: 'Lumièra Gentle Cleansing Gel',
    description: 'Pembersih wajah yang membantu membersihkan kotora, debu dan sisa makeup pada wajah. Diformulasikan khusus dengan kandungan niacinamide membantu mencerahkan dan melembabkan. sehingga kulit tampak lebih cerah,lembab dan lembut.',
    price: 95000,
    size: '100 ml',
    image: '/products/individual/lumiera-cleanser.webp',
    category: 'Lumièra Series'
  },
  {
    id: 'lumiera-moisturizer',
    name: 'Lumièra Bright Moist Crème',
    description: 'Moisturizer dengan kandungan 7x Ceramide dan Niacinamide membantu melembabkan, menghidrasi, dan mencerahkan kulit wajah. Sehingga kulit tampak lebih lembut, kenyal dan cerah.',
    price: 125000,
    size: '30 ml',
    image: '/products/individual/lumiera-moisturizer.webp',
    category: 'Lumièra Series'
  },
  {
    id: 'lumiera-uv-defense',
    name: 'Lumièra UV Defense Creme',
    description: 'Membantu melindungi kulit dari paparan sinar matahari langsung, membantu mencerahkan dan melembabkan kulit wajah. Sehingga tampak lebih flawless.',
    price: 120000,
    size: '30 gr',
    image: '/products/individual/lumiera-uv-defense.webp',
    category: 'Lumièra Series'
  },
  {
    id: 'lumiera-glow-serum',
    name: 'Lumièra Glow Serum',
    description: 'Serum dengan kandungan Vitamin C membantu mencerahkan, melembabkan kulit wajah. Sehingga tampak lebih lembut dan cerah.',
    price: 120000,
    size: '30 ml',
    image: '/products/individual/lumiera-glow-serum.webp',
    category: 'Lumièra Series'
  },
  // Anti Aging Series
  {
    id: 'antiaging-facial-wash',
    name: 'Gentle Brightening Facial Wash',
    description: 'Gentle Brightening Facial Wash merupakan Low pH Cleanser yang mengandung Panthenol, 10X Amino Acid, Jeju Centella dan Niacinamide yang bermanfaat untuk membantu memaksimalkan proses pembersihan kulit tanpa meninggalkan efek kulit kering serta menjaga kelembapan dan membantu mencerahkan kulit.',
    price: 85000,
    size: '100 ml',
    image: '/products/individual/antiaging-facial-wash.webp',
    category: 'Anti Aging Series'
  },
  {
    id: 'antiaging-moisturizer',
    name: 'Brightening Moisturizer With Tranexamic Acid & Jewelry Complex',
    description: 'Brightening Moisturizer ini merupakan moisturizer water based dengan tekstur gel ringan dan mudah menyerap. mengandung Niacinamide, Tranexamic Acid, a-arbutin, Hexyl Resorcinol, Marine Collagen, D-Panthenol, 10x Amino Acid. Perpaduan kandungan tersebut efektif untuk menyamarkan noda hitam, membantu mencerahkan dan meratakan warna kulit, menyamarkan kerutan serta menjaga kelembaban kulit.',
    price: 120000,
    size: '30 gr',
    image: '/products/individual/antiaging-moisturizer.webp',
    category: 'Anti Aging Series'
  },
  {
    id: 'antiaging-dna-serum',
    name: 'RevivAge DNA Serum',
    description: 'DNA Serum yang mengandung 5% Biotox LC (Botolinum Toxin Topical) yang bermanfaat menyamarkan kerutan pada wajah dan dipadukan dengan Niacinamide, Salmon DNA, Marine Collagen, 7 macam Hyaluronic Acid untuk mendukung regenerasi kulit, menjaga kelembapan serta mencerahkan kulit wajah.',
    price: 200000,
    size: '100 ml',
    image: '/products/individual/antiaging-dna-serum.webp',
    category: 'Anti Aging Series'
  },
];

const categories = [
  'All Products',
  'Acne Specialized Series',
  'Lumièra Series',
  'Anti Aging Series'
];

export default function ProductsPage() {
  const [selectedCategory, setSelectedCategory] = useState('All Products');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const filteredProducts = selectedCategory === 'All Products'
    ? products
    : products.filter(p => p.category === selectedCategory);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(price);
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev =>
      prev
        .map(item =>
          item.product.id === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter(item => item.quantity > 0)
    );
  };

  const handleCheckout = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      setCheckoutError('Nama dan nomor telepon wajib diisi');
      return;
    }
    if (cart.length === 0) {
      setCheckoutError('Keranjang masih kosong');
      return;
    }

    setCheckoutLoading(true);
    setCheckoutError('');

    try {
      const res = await fetch('/api/products/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(item => ({
            name: item.product.name,
            price: item.product.price,
            quantity: item.quantity,
          })),
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal memproses pesanan');
      }

      setCheckoutSuccess(true);
      setCart([]);
      setCartOpen(false);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Gagal memproses pesanan');
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <MobileLayout>
      <Navbar />

      <main className="min-h-screen bg-dark pt-24 pb-16">
        {/* Hero Section */}
        <section className="px-5 py-12 text-center relative">
          {/* Cart Button */}
          <button
            onClick={() => {
              setCartOpen(true);
              setCheckoutSuccess(false);
              setCheckoutError('');
            }}
            className="absolute right-5 top-12 md:right-10 md:top-12 w-14 h-14 bg-gradient-to-r from-primary to-primary-light rounded-full flex items-center justify-center shadow-xl shadow-primary/30 hover:scale-110 transition-transform z-10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>

          <h1 className="font-playfair text-5xl md:text-6xl font-bold text-primary mb-4">
            Product Gallery
          </h1>
          <p className="text-xl text-white/70 max-w-3xl mx-auto">
            Discover our premium skincare collection designed for your beauty journey
          </p>
        </section>

        {/* Category Filter */}
        <section className="px-5 mb-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-wrap justify-center gap-3">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
                    selectedCategory === category
                      ? 'bg-gradient-to-r from-primary to-primary-light text-dark'
                      : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Products Grid */}
        <section className="px-5">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="bg-gradient-to-br from-white/5 to-white/10 rounded-2xl overflow-hidden border border-white/10 hover:border-primary/50 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/20 group"
                >
                  {/* Product Image */}
                  <div
                    className="relative h-80 bg-white/5 flex items-center justify-center p-8 cursor-pointer"
                    onClick={() => setSelectedProduct(product)}
                  >
                    <Image
                      src={product.image}
                      alt={product.name}
                      width={180}
                      height={253}
                      className="object-contain transition-transform duration-300 group-hover:scale-110"
                    />
                  </div>

                  {/* Product Info */}
                  <div className="p-6">
                    <p className="text-primary text-sm font-semibold mb-2">
                      {product.category}
                    </p>
                    <h3 className="text-white font-bold text-lg mb-2 line-clamp-2">
                      {product.name}
                    </h3>
                    <p className="text-white/60 text-sm mb-4 line-clamp-2">
                      {product.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-primary font-bold text-xl">
                          {formatPrice(product.price)}
                        </p>
                        <p className="text-white/50 text-xs">{product.size}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedProduct(product)}
                          className="bg-white/10 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-white/20 transition-colors"
                        >
                          Detail
                        </button>
                        <button
                          onClick={() => addToCart(product)}
                          className="bg-gradient-to-r from-primary to-primary-light text-dark px-4 py-2 rounded-lg font-semibold text-sm hover:shadow-lg hover:shadow-primary/30 transition-all"
                        >
                          + Keranjang
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Package Banners */}
        <section className="px-5 mt-16">
          <div className="max-w-7xl mx-auto">
            <h2 className="font-playfair text-4xl font-bold text-primary mb-8 text-center">
              Special Packages
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Acne Package */}
              <div className="relative h-96 rounded-2xl overflow-hidden group cursor-pointer">
                <Image
                  src="/products/003.webp"
                  alt="Acne Specialized Series Package"
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-6">
                  <h3 className="text-white font-bold text-2xl mb-2">
                    Acne Specialized Series
                  </h3>
                  <p className="text-primary font-bold text-3xl">
                    Rp 450.000
                  </p>
                </div>
              </div>

              {/* Lumièra Package */}
              <div className="relative h-96 rounded-2xl overflow-hidden group cursor-pointer">
                <Image
                  src="/products/006.webp"
                  alt="Lumièra Series Package"
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-6">
                  <h3 className="text-white font-bold text-2xl mb-2">
                    Lumièra Series
                  </h3>
                  <p className="text-primary font-bold text-3xl">
                    Rp 450.000
                  </p>
                </div>
              </div>

              {/* Anti Aging Package */}
              <div className="relative h-96 rounded-2xl overflow-hidden group cursor-pointer">
                <Image
                  src="/products/009.webp"
                  alt="Anti Aging Series Package"
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-6">
                  <h3 className="text-white font-bold text-2xl mb-2">
                    Anti Aging Series
                  </h3>
                  <p className="text-primary font-bold text-3xl">
                    Rp 700.000
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-5"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="bg-gradient-to-br from-dark to-dark-lighter rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-primary/30"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid md:grid-cols-2 gap-8 p-8">
              {/* Product Image */}
              <div className="flex items-center justify-center bg-white/5 rounded-xl p-8">
                <Image
                  src={selectedProduct.image}
                  alt={selectedProduct.name}
                  width={300}
                  height={420}
                  className="object-contain"
                />
              </div>

              {/* Product Details */}
              <div>
                <p className="text-primary text-sm font-semibold mb-2">
                  {selectedProduct.category}
                </p>
                <h2 className="font-playfair text-3xl font-bold text-white mb-4">
                  {selectedProduct.name}
                </h2>
                <p className="text-white/70 mb-6 leading-relaxed">
                  {selectedProduct.description}
                </p>
                <div className="mb-6">
                  <p className="text-white/50 text-sm mb-1">Size</p>
                  <p className="text-white font-semibold">{selectedProduct.size}</p>
                </div>
                <div className="mb-8">
                  <p className="text-white/50 text-sm mb-1">Price</p>
                  <p className="text-primary font-bold text-4xl">
                    {formatPrice(selectedProduct.price)}
                  </p>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="flex-1 bg-white/10 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/20 transition-colors"
                  >
                    Tutup
                  </button>
                  <button
                    onClick={() => {
                      addToCart(selectedProduct);
                      setSelectedProduct(null);
                    }}
                    className="flex-1 bg-gradient-to-r from-primary to-primary-light text-dark px-6 py-3 rounded-lg font-semibold hover:shadow-xl hover:shadow-primary/40 transition-all"
                  >
                    + Keranjang
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-[60]">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setCartOpen(false);
              setCheckoutSuccess(false);
              setCheckoutError('');
            }}
          />

          {/* Drawer */}
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-gradient-to-b from-dark to-dark-lighter border-l border-white/10 flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-white font-bold text-xl flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
                Keranjang
                {cartCount > 0 && (
                  <span className="text-sm text-white/60">({cartCount} item)</span>
                )}
              </h2>
              <button
                onClick={() => {
                  setCartOpen(false);
                  setCheckoutSuccess(false);
                  setCheckoutError('');
                }}
                className="text-white/50 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-6">
              {checkoutSuccess ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-white font-bold text-xl mb-2">Pesanan Terkirim!</h3>
                  <p className="text-white/60">Tim kami akan menghubungi kamu segera via WhatsApp untuk konfirmasi.</p>
                </div>
              ) : cart.length === 0 ? (
                <div className="text-center py-12">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-white/20 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                  </svg>
                  <p className="text-white/40">Keranjang kamu masih kosong</p>
                </div>
              ) : (
                <div>
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex gap-4 py-4 border-b border-white/5 last:border-0"
                    >
                      <div className="w-16 h-20 bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Image
                          src={item.product.image}
                          alt={item.product.name}
                          width={48}
                          height={64}
                          className="object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-semibold text-sm line-clamp-2">
                          {item.product.name}
                        </h4>
                        <p className="text-white/50 text-xs mt-1">{item.product.size}</p>
                        <p className="text-primary font-bold text-sm mt-1">
                          {formatPrice(item.product.price)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end justify-between">
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-white/30 hover:text-red-400 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="w-7 h-7 rounded-full bg-white/10 text-white flex items-center justify-center text-sm hover:bg-white/20 transition-colors"
                          >
                            -
                          </button>
                          <span className="text-white font-semibold w-6 text-center text-sm">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.product.id, 1)}
                            className="w-7 h-7 rounded-full bg-white/10 text-white flex items-center justify-center text-sm hover:bg-white/20 transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Checkout Form */}
              {cart.length > 0 && !checkoutSuccess && (
                <div className="mt-6 space-y-4">
                  <h3 className="text-white font-bold text-lg mb-4">Data Pemesan</h3>
                  <div>
                    <label className="block text-white/60 text-sm mb-1">Nama *</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Nama lengkap kamu"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:border-primary/50 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 text-sm mb-1">No. WhatsApp *</label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Contoh: 081234567890"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:border-primary/50 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 text-sm mb-1">Email</label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="email@contoh.com"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:border-primary/50 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 text-sm mb-1">Catatan</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Catatan tambahan..."
                      rows={2}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:border-primary/50 focus:outline-none transition-colors resize-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {cart.length > 0 && !checkoutSuccess && (
              <div className="border-t border-white/10 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Total</span>
                  <span className="text-primary font-bold text-2xl">{formatPrice(cartTotal)}</span>
                </div>
                {checkoutError && (
                  <p className="text-red-400 text-sm text-center">{checkoutError}</p>
                )}
                <button
                  onClick={handleCheckout}
                  disabled={checkoutLoading}
                  className="w-full bg-gradient-to-r from-primary to-primary-light text-dark py-4 rounded-lg font-bold text-lg hover:shadow-xl hover:shadow-primary/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {checkoutLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Mengirim...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Checkout via WhatsApp
                    </>
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
