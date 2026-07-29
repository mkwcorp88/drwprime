'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import type { CartItem, CheckoutForm, PendingOrder } from '@/features/product-commerce/types';
import { getCategoryColor } from '@/features/product-commerce/category-theme';
import { formatPrice, cartTotal } from '@/features/product-commerce/formatters';
import { validateCheckout, type FieldErrors } from '@/features/product-commerce/validation';

interface CartDrawerProps {
  open: boolean;
  cart: CartItem[];
  onClose: () => void;
  onRemoveItem: (id: string) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onCheckout: (form: CheckoutForm, idempotencyKey: string) => Promise<{ paymentUrl: string; publicToken: string } | null>;
  pendingOrder: PendingOrder | null;
  clearPendingOrder: () => void;
}

function InputField({
  label, value, onChange, placeholder, error, type = 'text', autoComplete, inputMode, multiline,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  error?: string; type?: string; autoComplete?: string; inputMode?: string; multiline?: boolean;
}) {
  const id = useRef(`field-${label.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).slice(2, 6)}`);
  const baseClass = "w-full border rounded-xl px-4 py-3 text-sm transition-colors bg-white/5 text-white placeholder-white/20 focus:outline-none ";
  const borderClass = error ? 'border-red-500/50 focus:border-red-500' : 'border-white/[0.08] focus:border-primary/50';

  return (
    <div>
      <label htmlFor={id.current} className="block text-[11px] font-semibold mb-1.5 text-white/35">{label}</label>
      {multiline ? (
        <textarea id={id.current} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={2} className={`${baseClass}${borderClass} resize-none`} autoComplete={autoComplete} />
      ) : (
        <input id={id.current} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`${baseClass}${borderClass}`} autoComplete={autoComplete} inputMode={inputMode as React.HTMLAttributes<HTMLInputElement>['inputMode']} />
      )}
      {error && <p className="text-[10px] text-red-400 mt-1">{error}</p>}
    </div>
  );
}

const EMPTY_FORM: CheckoutForm = {
  customerName: '', customerPhone: '', customerEmail: '',
  shippingAddress: '', shippingCity: '', shippingProvince: '', shippingPostal: '', notes: '',
};

export default function CartDrawer({
  open, cart, onClose, onRemoveItem, onUpdateQuantity, onCheckout, pendingOrder, clearPendingOrder,
}: CartDrawerProps) {
  const [form, setForm] = useState<CheckoutForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<PendingOrder | null>(null);
  const [apiError, setApiError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setErrors({});
      setApiError('');
      setSuccess(null);
      document.body.style.overflow = 'hidden';
      setTimeout(() => dialogRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const handleInput = (field: keyof CheckoutForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fieldErrors = validateCheckout(form, cart.length);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setLoading(true);
    setApiError('');
    const idempotencyKey = `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      const result = await onCheckout(form, idempotencyKey);
      if (result) {
        setSuccess({ paymentUrl: result.paymentUrl, publicToken: result.publicToken, orderTotal: cartTotal(cart), timestamp: Date.now() });
      }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Gagal memproses pembayaran');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    if (success) clearPendingOrder();
    onClose();
  };

  if (!open) return null;

  const total = cartTotal(cart);
  const displayOrder = success || pendingOrder;

  return (
    <div className="fixed inset-0 z-[80]" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div className="absolute inset-0 lg:right-auto lg:w-full lg:max-w-md" onClick={e => e.stopPropagation()}>
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Keranjang" tabIndex={-1} className="h-full flex flex-col bg-[#0D0D10] shadow-2xl outline-none lg:border-r lg:border-white/[0.06]">
          <header className="flex items-center justify-between p-5 border-b border-white/[0.06] flex-shrink-0">
            <h2 className="font-bold text-lg flex items-center gap-2 text-white">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              Keranjang
              {cart.length > 0 && <span className="text-sm font-normal text-white/40">({cart.length})</span>}
            </h2>
            <button onClick={handleClose} disabled={loading} className="text-white/40 hover:text-white/70 transition-colors disabled:opacity-30">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </header>

          <div className="flex-1 overflow-y-auto">
            {displayOrder ? (
              <div className="p-5 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-primary/10">
                  <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="font-bold text-xl mb-2 text-white">Pesanan Dibuat!</h3>
                <p className="text-white/50 text-sm mb-6">Kamu akan diarahkan ke halaman pembayaran.</p>
                {displayOrder.paymentUrl && (
                  <a
                    href={displayOrder.paymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm text-black transition-all hover:shadow-xl"
                    style={{ background: '#D4AF37' }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    Bayar via DOKU
                  </a>
                )}
                {displayOrder.publicToken && (
                  <a
                    href={`/product-gallery/order/${displayOrder.publicToken}`}
                    className="block mt-4 text-primary text-sm hover:underline"
                  >
                    Lihat Status Pesanan →
                  </a>
                )}
              </div>
            ) : cart.length === 0 ? (
              <div className="text-center py-16">
                <svg className="w-16 h-16 mx-auto mb-4 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
                <p className="text-white/35 text-sm">Keranjang masih kosong</p>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                {cart.map(item => (
                  <div key={item.product.id} className="flex gap-3 py-3 border-b border-white/[0.04] last:border-0">
                    <div className="w-16 h-20 rounded-xl flex items-center justify-center shrink-0 bg-[#0A0A0C] border border-white/[0.04]">
                      <Image src={item.product.image || '/drwprime-product.webp'} alt={item.product.name} width={48} height={64} className="object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm line-clamp-2 text-white/85">{item.product.name}</h4>
                      <p className="text-[10px] mt-0.5 text-white/30">{item.product.size}</p>
                      <p className="font-bold text-sm mt-1" style={{ color: getCategoryColor(item.product.categoryId) }}>
                        {formatPrice(item.product.effectivePrice)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end justify-between">
                      <button onClick={() => onRemoveItem(item.product.id)} className="text-white/20 hover:text-red-400 transition-colors p-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <div className="flex items-center gap-1 bg-white/5 rounded-lg border border-white/[0.06] p-0.5">
                        <button onClick={() => onUpdateQuantity(item.product.id, -1)} className="w-8 h-8 rounded-md flex items-center justify-center text-white/40 text-sm font-semibold hover:bg-white/5">-</button>
                        <span className="w-6 text-center text-xs font-semibold text-white">{item.quantity}</span>
                        <button onClick={() => onUpdateQuantity(item.product.id, 1)} className="w-8 h-8 rounded-md flex items-center justify-center text-white/40 text-sm font-semibold hover:bg-white/5">+</button>
                      </div>
                    </div>
                  </div>
                ))}

                <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 pt-4 border-t border-white/[0.06]" noValidate>
                  <h3 className="font-bold text-sm text-white/70">Data Penerima</h3>
                  <InputField label="Nama *" value={form.customerName} onChange={v => handleInput('customerName', v)} placeholder="Nama lengkap" error={errors.customerName} autoComplete="name" />
                  <InputField label="WhatsApp *" value={form.customerPhone} onChange={v => handleInput('customerPhone', v)} placeholder="0812-3456-7890" error={errors.customerPhone} type="tel" autoComplete="tel" inputMode="tel" />
                  <InputField label="Email" value={form.customerEmail} onChange={v => handleInput('customerEmail', v)} placeholder="email@contoh.com" error={errors.customerEmail} type="email" autoComplete="email" inputMode="email" />
                  <InputField label="Alamat Lengkap *" value={form.shippingAddress} onChange={v => handleInput('shippingAddress', v)} placeholder="Jalan, nomor, RT/RW, patokan..." error={errors.shippingAddress} autoComplete="street-address" multiline />
                  <div className="grid grid-cols-2 gap-3">
                    <InputField label="Kota/Kab *" value={form.shippingCity} onChange={v => handleInput('shippingCity', v)} placeholder="Kota" error={errors.shippingCity} autoComplete="address-level2" />
                    <InputField label="Kode Pos" value={form.shippingPostal} onChange={v => handleInput('shippingPostal', v)} placeholder="12345" inputMode="numeric" autoComplete="postal-code" />
                  </div>
                  <InputField label="Provinsi *" value={form.shippingProvince} onChange={v => handleInput('shippingProvince', v)} placeholder="Provinsi" error={errors.shippingProvince} autoComplete="address-level1" />
                  <InputField label="Catatan" value={form.notes} onChange={v => handleInput('notes', v)} placeholder="Catatan kurir / patokan..." multiline />
                </form>
              </div>
            )}
          </div>

          {cart.length > 0 && !displayOrder && (
            <footer className="border-t border-white/[0.06] p-5 space-y-3 flex-shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/50">Total</span>
                <span className="font-bold text-xl text-primary">{formatPrice(total)}</span>
              </div>
              {apiError && <p className="text-red-400 text-xs text-center">{apiError}</p>}
              <button
                onClick={() => formRef.current?.requestSubmit()}
                disabled={loading}
                className="w-full py-4 rounded-xl font-bold text-base transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: '#D4AF37', color: '#0B0B0C' }}
              >
                {loading ? (
                  <><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg> Memproses...</>
                ) : (
                  <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg> Lanjut ke Pembayaran</>
                )}
              </button>
            </footer>
          )}
        </div>
      </div>
    </div>
  );
}
