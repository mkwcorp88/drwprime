'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type Category = { id: string; slug: string; name: string; _count?: { products: number } };

type Product = {
  id: string;
  slug: string;
  name: string;
  headline: string | null;
  description: string;
  price: number;
  size: string | null;
  imageUrl: string | null;
  imageKey: string | null;
  benefits: string[];
  usageInstructions: string | null;
  ctaText: string | null;
  sortOrder: number;
  isActive: boolean;
  categoryId: string;
  category: Category;
  promotions: Promotion[];
};

type Promotion = {
  id: string;
  productId: string;
  title: string;
  badgeText: string | null;
  finalPrice: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  product: { id: string; name: string; slug: string; price: number; imageUrl: string | null };
};

type Tab = 'products' | 'promotions';

const TABS: { key: Tab; label: string }[] = [
  { key: 'products', label: 'Etalase' },
  { key: 'promotions', label: 'Promo' },
];

const CATEGORY_FILTER_ALL = '__all__';

const initialProductForm = {
  name: '',
  slug: '',
  categoryId: '',
  description: '',
  price: '',
  size: '',
  headline: '',
  benefits: '',
  usageInstructions: '',
  ctaText: '',
  sortOrder: '0',
  isActive: true,
  imageUrl: '',
  imageKey: '',
};

const initialPromoForm = {
  productId: '',
  title: '',
  badgeText: '',
  finalPrice: '',
  startsAt: '',
  endsAt: '',
};

const TEMP_CATEGORIES: Category[] = [
  { id: 'facial-wash', slug: 'facial-wash', name: 'Facial Wash' },
  { id: 'moisturizer', slug: 'moisturizer', name: 'Moisturizer' },
  { id: 'sunscreen', slug: 'sunscreen', name: 'Sunscreen' },
  { id: 'serum', slug: 'serum', name: 'Serum' },
  { id: 'toner', slug: 'toner', name: 'Toner' },
];

export default function FrontOfficeProductsPage() {
  const [tab, setTab] = useState<Tab>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState(CATEGORY_FILTER_ALL);
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [productForm, setProductForm] = useState(initialProductForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const [promoEditorOpen, setPromoEditorOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<string | null>(null);
  const [promoForm, setPromoForm] = useState(initialPromoForm);
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [promoSuccess, setPromoSuccess] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'product' | 'promo'; id: string; name: string } | null>(null);

  const mergedCategories = useMemo(() => {
    const allCategories = [...TEMP_CATEGORIES, ...categories];
    const uniqueCategories = allCategories.filter(
      (category, index, self) =>
        index === self.findIndex((c) => (
          c.slug === category.slug
        ))
    );
    return uniqueCategories.sort((a, b) => a.name.localeCompare(b.name));
  }, [categories]);


  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/front-office/products');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat produk');
      setProducts(data.products || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data');
    }
  }, []);

  const fetchPromotions = useCallback(async () => {
    try {
      const res = await fetch('/api/front-office/product-promotions');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat promo');
      setPromotions(data.promotions || []);
    } catch { /* non-critical */ }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/front-office/product-categories');
      const data = await res.json();
      if (res.ok) setCategories(data.categories || []);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { setLoading(true); fetchProducts().finally(() => setLoading(false)); }, [fetchProducts]);
  useEffect(() => { fetchPromotions(); }, [fetchPromotions]);
  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const reload = () => {
    setLoading(true);
    Promise.all([fetchProducts(), fetchPromotions()]).finally(() => setLoading(false));
  };

  const filteredProducts = products.filter(p => {
    if (search) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !(p.headline || '').toLowerCase().includes(q)) return false;
    }
    if (catFilter !== CATEGORY_FILTER_ALL && p.categoryId !== catFilter) return false;
    if (statusFilter === 'active' && !p.isActive) return false;
    if (statusFilter === 'inactive' && p.isActive) return false;
    return true;
  });

  const filteredPromotions = promotions.filter(p => {
    if (search) {
      const q = search.toLowerCase();
      if (!p.title.toLowerCase().includes(q) && !p.product.name.toLowerCase().includes(q)) return false;
    }
    if (catFilter !== CATEGORY_FILTER_ALL && p.productId !== catFilter) {
      const prod = products.find(pr => pr.id === p.productId);
      if (!prod || prod.categoryId !== catFilter) return false;
    }
    return true;
  });

  const now = new Date();
  const activeProducts = products.filter(p => p.isActive).length;
  const activePromos = promotions.filter(p => p.isActive && new Date(p.startsAt) <= now && new Date(p.endsAt) > now).length;
  const scheduledPromos = promotions.filter(p => p.isActive && new Date(p.startsAt) > now).length;

  const formatPrice = (p: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(p);

  const getEffectivePrice = (product: Product) => {
    const active = product.promotions.find(
      pr => pr.isActive && new Date(pr.startsAt) <= now && new Date(pr.endsAt) > now && Number(pr.finalPrice) < product.price
    );
    return active ? Number(active.finalPrice) : product.price;
  };

  const getPromoStatus = (p: Promotion) => {
    if (!p.isActive) return { label: 'Nonaktif', className: 'text-gray-500 bg-gray-100' };
    const s = new Date(p.startsAt);
    const e = new Date(p.endsAt);
    if (now < s) return { label: 'Terjadwal', className: 'text-blue-600 bg-blue-50' };
    if (now >= s && now < e) return { label: 'Aktif', className: 'text-green-600 bg-green-50' };
    return { label: 'Kedaluwarsa', className: 'text-orange-600 bg-orange-50' };
  };

  const openAddProduct = () => {
    setEditingProduct(null);
    setProductForm(initialProductForm);
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
    setFormError('');
    setFormSuccess('');
    setEditorOpen(true);
  };

  const openEditProduct = (p: Product) => {
    setEditingProduct(p.id);
    setProductForm({
      name: p.name,
      slug: p.slug,
      categoryId: p.categoryId,
      description: p.description,
      price: String(p.price),
      size: p.size || '',
      headline: p.headline || '',
      benefits: p.benefits.join('\n'),
      usageInstructions: p.usageInstructions || '',
      ctaText: p.ctaText || '',
      sortOrder: String(p.sortOrder),
      isActive: p.isActive,
      imageUrl: p.imageUrl || '',
      imageKey: p.imageKey || '',
    });
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
    setFormError('');
    setFormSuccess('');
    setEditorOpen(true);
  };

  const uploadProductImage = async (file: File): Promise<{ url: string; pathname: string }> => {
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/front-office/products/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload gagal');
      return { url: data.url, pathname: data.pathname };
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProduct = async () => {
    setFormError('');
    setFormSuccess('');
    if (!productForm.name.trim() || !productForm.slug.trim() || !productForm.categoryId || !productForm.description.trim()) {
      setFormError('Nama, slug, kategori, dan deskripsi wajib diisi');
      return;
    }
    setSaving(true);
    try {
      let imageUrl = productForm.imageUrl;
      let imageKey = productForm.imageKey;

      if (selectedImageFile) {
        const uploaded = await uploadProductImage(selectedImageFile);
        imageUrl = uploaded.url;
        imageKey = uploaded.pathname;
      }

      const payload = {
        id: editingProduct || undefined,
        name: productForm.name,
        slug: productForm.slug,
        categoryId: productForm.categoryId,
        description: productForm.description,
        price: Number(productForm.price),
        size: productForm.size || null,
        headline: productForm.headline || null,
        imageUrl: imageUrl || null,
        imageKey: imageKey || null,
        benefits: productForm.benefits.split('\n').filter(Boolean),
        usageInstructions: productForm.usageInstructions || null,
        ctaText: productForm.ctaText || null,
        sortOrder: Number(productForm.sortOrder) || 0,
        isActive: productForm.isActive,
      };

      const method = editingProduct ? 'PUT' : 'POST';
      const res = await fetch('/api/front-office/products', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      setFormSuccess(data.message || 'Berhasil disimpan');
      setSelectedImageFile(null);
      setImagePreviewUrl(null);
      reload();
      if (!editingProduct) setEditorOpen(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (p: Product) => {
    try {
      const res = await fetch('/api/front-office/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, isActive: !p.isActive }),
      });
      if (res.ok) reload();
    } catch { /* fall through */ }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      const res = await fetch(`/api/front-office/products?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) { setFormSuccess(data.message || 'Produk dihapus'); reload(); }
      else setFormError(data.error || 'Gagal menghapus');
    } catch { setFormError('Gagal menghapus'); }
    setDeleteConfirm(null);
  };

  const openAddPromo = () => {
    setEditingPromo(null);
    setPromoForm(initialPromoForm);
    setPromoError('');
    setPromoSuccess('');
    setPromoEditorOpen(true);
  };

  const openEditPromo = (p: Promotion) => {
    setEditingPromo(p.id);
    setPromoForm({
      productId: p.productId,
      title: p.title,
      badgeText: p.badgeText || '',
      finalPrice: String(p.finalPrice),
      startsAt: new Date(p.startsAt).toISOString().slice(0, 16),
      endsAt: new Date(p.endsAt).toISOString().slice(0, 16),
    });
    setPromoError('');
    setPromoSuccess('');
    setPromoEditorOpen(true);
  };

  const handleSavePromo = async () => {
    setPromoError('');
    setPromoSuccess('');
    if (!promoForm.productId || !promoForm.title.trim()) {
      setPromoError('Produk dan judul promo wajib diisi');
      return;
    }
    setPromoSaving(true);
    try {
      const payload = {
        productId: promoForm.productId,
        title: promoForm.title,
        badgeText: promoForm.badgeText || null,
        finalPrice: Number(promoForm.finalPrice),
        startsAt: new Date(promoForm.startsAt).toISOString(),
        endsAt: new Date(promoForm.endsAt).toISOString(),
      };

      const method = editingPromo ? 'PATCH' : 'POST';
      let url = '/api/front-office/product-promotions';
      if (editingPromo) url = `${url}/${editingPromo}`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      setPromoSuccess(data.message || 'Promo berhasil disimpan');
      reload();
      if (!editingPromo) setPromoEditorOpen(false);
    } catch (e) {
      setPromoError(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally {
      setPromoSaving(false);
    }
  };

  const handleDeletePromo = async (id: string) => {
    try {
      const res = await fetch(`/api/front-office/product-promotions/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) { setPromoSuccess(data.message || 'Promo dihapus'); reload(); }
      else setPromoError(data.error || 'Gagal menghapus');
    } catch { setPromoError('Gagal menghapus'); }
    setDeleteConfirm(null);
  };

  return (
    <div className="min-h-screen bg-[#030303] pt-20 pb-20 lg:pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white/90">Products & Promo</h1>
            <p className="text-sm text-white/40 mt-1">Kelola katalog produk dan promo harga terjadwal</p>
          </div>
          <div className="flex gap-3">
            <Link href="/product-gallery" target="_blank" className="fo-ios-btn fo-ios-btn-neutral text-xs">Lihat Etalase</Link>
            <Link href="/front-office/report-product-daily" className="fo-ios-btn fo-ios-btn-info text-xs">Laporan Penjualan</Link>
            <Link href="/front-office" className="fo-ios-btn fo-ios-btn-neutral text-xs">← FO</Link>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Produk', value: products.length },
            { label: 'Produk Aktif', value: activeProducts },
            { label: 'Promo Aktif', value: activePromos },
            { label: 'Promo Terjadwal', value: scheduledPromos },
          ].map(s => (
            <div key={s.label} className="fo-glass-card-soft rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white/80">{s.value}</p>
              <p className="text-[10px] text-white/35 uppercase tracking-wider mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSearch(''); }}
              className={`px-5 py-2.5 rounded-full font-semibold text-sm transition-all ${
                tab === t.key ? 'bg-primary/20 text-primary border border-primary/40' : 'text-white/40 hover:text-white/70'
              }`}
            >
              {t.label}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={tab === 'products' ? openAddProduct : openAddPromo}
            className="fo-ios-btn fo-ios-btn-success text-xs"
          >
            + {tab === 'products' ? 'Produk' : 'Promo'}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'products' ? 'Cari nama produk...' : 'Cari promo atau produk...'}
            className="fo-glass-input rounded-xl px-4 py-2.5 text-sm flex-1 min-w-[200px]"
          />
          <select
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
            className="fo-glass-input rounded-xl px-3 py-2.5 text-sm bg-[#080808]"
          >
            <option value={CATEGORY_FILTER_ALL}>Semua Kategori</option>
            {mergedCategories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {tab === 'products' && (
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="fo-glass-input rounded-xl px-3 py-2.5 text-sm bg-[#080808]"
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          )}
          <div className="flex items-center gap-1 p-1 rounded-xl fo-glass-input bg-[#080808]">
            <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === 'list' ? 'bg-primary/20 text-primary' : 'text-white/40 hover:text-white/70'}`}>List</button>
            <button onClick={() => setViewMode('grid')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === 'grid' ? 'bg-primary/20 text-primary' : 'text-white/40 hover:text-white/70'}`}>Grid</button>
          </div>
        </div>

        {/* Success/Error Banners */}
        {(formSuccess || formError) && (
          <div className={`mb-4 p-3 rounded-xl text-sm ${formSuccess ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
            {formSuccess || formError}
            <button onClick={() => { setFormSuccess(''); setFormError(''); }} className="ml-3 opacity-50 hover:opacity-100">✕</button>
          </div>
        )}
        {(promoSuccess || promoError) && (
          <div className={`mb-4 p-3 rounded-xl text-sm ${promoSuccess ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
            {promoSuccess || promoError}
            <button onClick={() => { setPromoSuccess(''); setPromoError(''); }} className="ml-3 opacity-50 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-20 text-white/30">Memuat data...</div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="text-center py-20">
            <p className="text-red-400 mb-3">{error}</p>
            <button onClick={reload} className="fo-ios-btn fo-ios-btn-neutral text-sm">Coba Lagi</button>
          </div>
        )}

        {/* Products Table */}
        {!loading && !error && tab === 'products' && (
          <>
            {filteredProducts.length === 0 ? (
              <div className="text-center py-20 text-white/30">
                {search || catFilter !== CATEGORY_FILTER_ALL ? 'Tidak ada produk dengan filter ini' : 'Belum ada produk'}
              </div>
            ) : (
              viewMode === 'list' ? (
                <div className="space-y-3">
                  {filteredProducts.map(p => {
                    const effPrice = getEffectivePrice(p);
                    const hasPromo = effPrice < p.price;
                    return (
                      <div key={p.id} className="fo-glass-card-soft rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start">
                        <div className="w-16 h-20 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          {p.imageUrl ? (
                            <Image src={p.imageUrl} alt={p.name} width={48} height={64} className="object-contain max-h-full" />
                          ) : (
                            <span className="text-white/10 text-2xl">📦</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-white/85 text-sm">{p.name}</h3>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{p.category.name}</span>
                            {!p.isActive && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">Nonaktif</span>}
                          </div>
                          <p className="text-xs text-white/35 mt-1">{p.size}{p.headline && ` — ${p.headline}`}</p>
                          <div className="flex items-center gap-3 mt-2">
                            {hasPromo ? (
                              <>
                                <span className="text-sm text-white/30 line-through">{formatPrice(p.price)}</span>
                                <span className="text-sm font-bold text-emerald-400">{formatPrice(effPrice)}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Promo</span>
                              </>
                            ) : (
                              <span className="text-sm font-bold text-white/70">{formatPrice(p.price)}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          <button onClick={() => openEditProduct(p)} className="fo-ios-btn fo-ios-btn-neutral text-xs">Edit</button>
                          <button
                            onClick={() => handleToggleActive(p)}
                            className={`fo-ios-btn text-xs ${p.isActive ? 'fo-ios-btn-warn' : 'fo-ios-btn-success'}`}
                          >
                            {p.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ type: 'product', id: p.id, name: p.name })}
                            className="fo-ios-btn fo-ios-btn-danger text-xs"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {filteredProducts.map(p => {
                    const effPrice = getEffectivePrice(p);
                    const hasPromo = effPrice < p.price;
                    return (
                      <div key={p.id} className="fo-glass-card-soft rounded-xl p-3 flex flex-col h-full group relative">
                        <div className="w-full h-32 rounded-lg flex items-center justify-center mb-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                          {p.imageUrl ? (
                            <Image src={p.imageUrl} alt={p.name} width={80} height={120} className="object-contain max-h-full" />
                          ) : (
                            <span className="text-white/10 text-3xl">📦</span>
                          )}
                        </div>
                        <h4 className="font-semibold text-white/80 text-xs leading-tight flex-1">{p.name}</h4>
                        <div className="mt-2">
                          {!p.isActive && <span className="block text-center text-[9px] mb-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">Nonaktif</span>}
                          {hasPromo ? (
                            <div className="text-center">
                              <p className="text-xs text-white/30 line-through -mb-1">{formatPrice(p.price)}</p>
                              <p className="text-sm font-bold text-emerald-400">{formatPrice(effPrice)}</p>
                            </div>
                          ) : (
                            <p className="text-sm font-bold text-white/70 text-center">{formatPrice(p.price)}</p>
                          )}
                        </div>
                        <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditProduct(p)} className="p-1.5 rounded-full bg-black/40 hover:bg-black/80 backdrop-blur-sm">
                            <svg className="w-3.5 h-3.5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg>
                          </button>
                           <button onClick={() => handleToggleActive(p)} className="p-1.5 rounded-full bg-black/40 hover:bg-black/80 backdrop-blur-sm">
                            {p.isActive ? <svg className="w-3.5 h-3.5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg> : <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}
          </>
        )}

        {/* Promotions Table */}
        {!loading && !error && tab === 'promotions' && (
          <>
            {filteredPromotions.length === 0 ? (
              <div className="text-center py-20 text-white/30">
                {search ? 'Tidak ada promo dengan filter ini' : 'Belum ada promo'}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPromotions.map(p => {
                  const status = getPromoStatus(p);
                  return (
                    <div key={p.id} className="fo-glass-card-soft rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start">
                      <div className="w-16 h-20 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        {p.product.imageUrl ? (
                          <Image src={p.product.imageUrl} alt={p.product.name} width={48} height={64} className="object-contain max-h-full" />
                        ) : (
                          <span className="text-white/10 text-2xl">🏷️</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-white/85 text-sm">{p.title}</h3>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${status.className}`}>{status.label}</span>
                          {p.badgeText && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/50">{p.badgeText}</span>}
                        </div>
                        <p className="text-xs text-white/35 mt-1">Produk: {p.product.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm text-white/30 line-through">{formatPrice(p.product.price)}</span>
                          <span className="text-sm font-bold text-emerald-400">{formatPrice(Number(p.finalPrice))}</span>
                        </div>
                        <p className="text-[10px] text-white/25 mt-1">
                          {new Date(p.startsAt).toLocaleString('id-ID')} — {new Date(p.endsAt).toLocaleString('id-ID')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button onClick={() => openEditPromo(p)} className="fo-ios-btn fo-ios-btn-neutral text-xs">Edit</button>
                        <button
                          onClick={() => setDeleteConfirm({ type: 'promo', id: p.id, name: p.title })}
                          className="fo-ios-btn fo-ios-btn-danger text-xs"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Product Editor Overlay */}
        {editorOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 pb-20 overflow-y-auto" onClick={() => setEditorOpen(false)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
              className="relative w-full max-w-xl mx-4 fo-glass-modal rounded-2xl p-4 sm:p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white/85">{editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}</h2>
                <button onClick={() => setEditorOpen(false)} className="text-white/30 hover:text-white/70 text-xl">✕</button>
              </div>

              <div className="space-y-5 max-h-[62vh] overflow-y-auto pr-2">
                {/* ── Section: Gambar ── */}
                <div>
                  <p className="text-[11px] font-semibold text-primary/70 uppercase tracking-wider mb-2">📸 Gambar Produk</p>
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 w-24 h-32 rounded-xl flex items-center justify-center border-2 border-dashed border-white/15"
                      style={{ background: 'rgba(255,255,255,0.04)' }}>
                      {(imagePreviewUrl || productForm.imageUrl) ? (
                        <Image
                          src={imagePreviewUrl || productForm.imageUrl}
                          alt="Preview"
                          width={80} height={96}
                          className="object-contain max-h-full max-w-full rounded-lg"
                        />
                      ) : (
                        <div className="text-center text-white/20">
                          <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-[9px]">Preview</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="fo-ios-btn fo-ios-btn-neutral text-xs cursor-pointer inline-flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        {productForm.imageUrl || selectedImageFile ? 'Ganti Gambar' : 'Pilih Gambar'}
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) {
                              setSelectedImageFile(f);
                              setImagePreviewUrl(URL.createObjectURL(f));
                              setFormError('');
                            }
                          }}
                        />
                      </label>
                      {(productForm.imageUrl || selectedImageFile) && (
                        <button
                          onClick={() => {
                            setSelectedImageFile(null);
                            setImagePreviewUrl(null);
                            setProductForm(f => ({ ...f, imageUrl: '', imageKey: '' }));
                          }}
                          className="fo-ios-btn fo-ios-btn-danger text-xs mt-2"
                        >
                          Hapus Gambar
                        </button>
                      )}
                      <p className="text-[10px] text-white/25 mt-1.5">JPG, PNG, WEBP • Maks 10MB</p>
                    </div>
                  </div>
                </div>

                {/* ── Section: Informasi Dasar ── */}
                <div>
                  <p className="text-[11px] font-semibold text-primary/70 uppercase tracking-wider mb-2">📋 Informasi Dasar</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-white/50 mb-1">Nama Produk *</label>
                      <input type="text" value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))}
                        className="fo-glass-input rounded-xl px-3 py-2.5 text-sm w-full" placeholder="Nama produk" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/50 mb-1">Slug URL *</label>
                      <input type="text" value={productForm.slug} onChange={e => setProductForm(f => ({ ...f, slug: e.target.value }))}
                        className="fo-glass-input rounded-xl px-3 py-2.5 text-sm w-full" placeholder="nama-produk" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-xs font-semibold text-white/50 mb-1">Kategori *</label>
                      <select value={productForm.categoryId} onChange={e => setProductForm(f => ({ ...f, categoryId: e.target.value }))}
                        className="fo-glass-input rounded-xl px-3 py-2.5 text-sm w-full bg-[#080808]">
                        <option value="">Pilih kategori...</option>
                        {mergedCategories.map(c => <option key={c.slug} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/50 mb-1">Harga (Rp) *</label>
                      <input type="number" value={productForm.price} onChange={e => setProductForm(f => ({ ...f, price: e.target.value }))}
                        className="fo-glass-input rounded-xl px-3 py-2.5 text-sm w-full" placeholder="95000" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-xs font-semibold text-white/50 mb-1">Ukuran</label>
                      <input type="text" value={productForm.size} onChange={e => setProductForm(f => ({ ...f, size: e.target.value }))}
                        className="fo-glass-input rounded-xl px-3 py-2.5 text-sm w-full" placeholder="100 ml" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/50 mb-1">Headline / Tagline</label>
                      <input type="text" value={productForm.headline} onChange={e => setProductForm(f => ({ ...f, headline: e.target.value }))}
                        className="fo-glass-input rounded-xl px-3 py-2.5 text-sm w-full" placeholder="Tagline singkat" />
                    </div>
                  </div>
                </div>

                {/* ── Section: Deskripsi ── */}
                <div>
                  <p className="text-[11px] font-semibold text-primary/70 uppercase tracking-wider mb-2">📝 Deskripsi & Manfaat</p>
                  <div>
                    <label className="block text-xs font-semibold text-white/50 mb-1">Deskripsi Produk *</label>
                    <textarea value={productForm.description} onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))}
                      className="fo-glass-input rounded-xl px-3 py-2.5 text-sm w-full" rows={3} placeholder="Deskripsi lengkap produk" />
                  </div>
                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-white/50 mb-1">Manfaat (satu per baris)</label>
                    <textarea value={productForm.benefits} onChange={e => setProductForm(f => ({ ...f, benefits: e.target.value }))}
                      className="fo-glass-input rounded-xl px-3 py-2.5 text-sm w-full" rows={3} placeholder="Membersihkan debu&#10;Mencerahkan kulit" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-xs font-semibold text-white/50 mb-1">Cara Pakai</label>
                      <textarea value={productForm.usageInstructions} onChange={e => setProductForm(f => ({ ...f, usageInstructions: e.target.value }))}
                        className="fo-glass-input rounded-xl px-3 py-2.5 text-sm w-full" rows={2} placeholder="Petunjuk penggunaan" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/50 mb-1">Teks Tombol CTA</label>
                      <input type="text" value={productForm.ctaText} onChange={e => setProductForm(f => ({ ...f, ctaText: e.target.value }))}
                        className="fo-glass-input rounded-xl px-3 py-2.5 text-sm w-full" placeholder="Beli Sekarang" />
                    </div>
                  </div>
                </div>

                {/* ── Section: Pengaturan ── */}
                <div>
                  <p className="text-[11px] font-semibold text-primary/70 uppercase tracking-wider mb-2">⚙️ Pengaturan</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-white/50 mb-1">Urutan Tampil</label>
                      <input type="number" value={productForm.sortOrder} onChange={e => setProductForm(f => ({ ...f, sortOrder: e.target.value }))}
                        className="fo-glass-input rounded-xl px-3 py-2.5 text-sm w-full" placeholder="0" />
                    </div>
                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2.5 text-sm text-white/60 cursor-pointer">
                        <input type="checkbox" checked={productForm.isActive} onChange={e => setProductForm(f => ({ ...f, isActive: e.target.checked }))}
                          className="rounded accent-primary" />
                        Produk Aktif
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feedback */}
              {formError && <p className="mt-3 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{formError}</p>}
              {formSuccess && <p className="mt-3 text-xs text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2">{formSuccess}</p>}

              <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-white/10">
                <button onClick={() => setEditorOpen(false)} className="fo-ios-btn fo-ios-btn-neutral text-sm">Batal</button>
                <button onClick={handleSaveProduct} disabled={saving || uploadingImage}
                  className="fo-ios-btn text-sm text-white font-semibold px-6" style={{ background: '#D4AF37' }}>
                  {saving || uploadingImage ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {uploadingImage ? 'Upload...' : 'Menyimpan...'}
                    </span>
                  ) : editingProduct ? 'Update' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Promo Editor Overlay */}
        {promoEditorOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 pb-20 overflow-y-auto" onClick={() => setPromoEditorOpen(false)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
              className="relative w-full max-w-lg mx-4 fo-glass-modal rounded-2xl p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white/85">{editingPromo ? 'Edit Promo' : 'Tambah Promo'}</h2>
                <button onClick={() => setPromoEditorOpen(false)} className="text-white/30 hover:text-white/70 text-xl">✕</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-white/50 mb-1">Produk *</label>
                  <select value={promoForm.productId} onChange={e => setPromoForm(f => ({ ...f, productId: e.target.value }))}
                    className="fo-glass-input rounded-xl px-3 py-2.5 text-sm w-full bg-[#080808]">
                    <option value="">Pilih produk...</option>
                    {products.filter(p => p.isActive).map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({formatPrice(p.price)})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 mb-1">Judul Promo *</label>
                  <input type="text" value={promoForm.title} onChange={e => setPromoForm(f => ({ ...f, title: e.target.value }))}
                    className="fo-glass-input rounded-xl px-3 py-2.5 text-sm w-full" placeholder="Flash Sale Agustus" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 mb-1">Badge (opsional)</label>
                  <input type="text" value={promoForm.badgeText} onChange={e => setPromoForm(f => ({ ...f, badgeText: e.target.value }))}
                    className="fo-glass-input rounded-xl px-3 py-2.5 text-sm w-full" placeholder="SALE" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 mb-1">Harga Promo (Rp) *</label>
                  <input type="number" value={promoForm.finalPrice} onChange={e => setPromoForm(f => ({ ...f, finalPrice: e.target.value }))}
                    className="fo-glass-input rounded-xl px-3 py-2.5 text-sm w-full" placeholder="75000" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-white/50 mb-1">Mulai *</label>
                    <input type="datetime-local" value={promoForm.startsAt} onChange={e => setPromoForm(f => ({ ...f, startsAt: e.target.value }))}
                      className="fo-glass-input rounded-xl px-3 py-2.5 text-sm w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/50 mb-1">Selesai *</label>
                    <input type="datetime-local" value={promoForm.endsAt} onChange={e => setPromoForm(f => ({ ...f, endsAt: e.target.value }))}
                      className="fo-glass-input rounded-xl px-3 py-2.5 text-sm w-full" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                <button onClick={() => setPromoEditorOpen(false)} className="fo-ios-btn fo-ios-btn-neutral text-sm">Batal</button>
                <button onClick={handleSavePromo} disabled={promoSaving}
                  className="fo-ios-btn text-sm text-white" style={{ background: '#D4AF37' }}>
                  {promoSaving ? 'Menyimpan...' : editingPromo ? 'Update' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Overlay */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setDeleteConfirm(null)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div className="relative fo-glass-modal rounded-2xl p-6 max-w-sm mx-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-white/85 mb-2">Konfirmasi Hapus</h3>
              <p className="text-sm text-white/50 mb-6">Yakin ingin menghapus <strong className="text-white/80">{deleteConfirm.name}</strong>?</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="fo-ios-btn fo-ios-btn-neutral text-sm">Batal</button>
                <button
                  onClick={() => deleteConfirm.type === 'product' ? handleDeleteProduct(deleteConfirm.id) : handleDeletePromo(deleteConfirm.id)}
                  className="fo-ios-btn fo-ios-btn-danger text-sm"
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
