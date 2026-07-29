'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface OrderInfo {
  invoiceNumber: string;
  publicToken: string;
  totalAmount: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  paymentStatus: string;
  items: { productName: string; productPrice: number; quantity: number; subtotal: number; productSize: string | null }[];
  createdAt: string;
}

const PAYMENT_METHODS = [
  { id: 'dummy_va_bca', label: 'Virtual Account BCA', icon: '🏦', bank: 'BCA' },
  { id: 'dummy_va_mandiri', label: 'Virtual Account Mandiri', icon: '🏦', bank: 'Mandiri' },
  { id: 'dummy_va_bni', label: 'Virtual Account BNI', icon: '🏦', bank: 'BNI' },
  { id: 'dummy_qris', label: 'QRIS', icon: '📱', bank: 'QRIS' },
  { id: 'dummy_transfer', label: 'Transfer Bank', icon: '💳', bank: 'Transfer' },
  { id: 'dummy_ewallet', label: 'E-Wallet (GoPay/OVO/Dana)', icon: '📲', bank: 'E-Wallet' },
  { id: 'dummy_retail', label: 'Gerai Retail (Alfamart/Indomaret)', icon: '🏪', bank: 'Retail' },
];

export default function PaymentPage() {
  const { publicToken } = useParams<{ publicToken: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [paying, setPaying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!publicToken) return;
    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/products/orders/${publicToken}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Pesanan tidak ditemukan');
        if (data.order.paymentStatus !== 'pending') {
          setError(`Pesanan sudah ${data.order.paymentStatus}. Tidak dapat melakukan pembayaran.`);
          setLoading(false);
          return;
        }
        setOrder(data.order);
        setError('');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal memuat detail pesanan');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [publicToken]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const formatPrice = (p: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(p);

  const generateVaNumber = (prefix: string) => {
    const digits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
    return `${prefix}${digits}`;
  };

  const generateQrCode = () => Math.random().toString(36).substring(2, 10).toUpperCase();

  const handlePay = async () => {
    if (!selectedMethod) return;
    setPaying(true);

    // Simulate processing delay
    await new Promise(r => setTimeout(r, 2000));

    try {
      const res = await fetch('/api/payment/dummy-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicToken, paymentMethod: selectedMethod }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memproses');

      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pembayaran gagal');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07070A] flex items-center justify-center">
        <div className="flex items-center gap-3 text-white/30">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Memuat halaman pembayaran...</span>
        </div>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-screen bg-[#07070A] flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-red-400 font-medium mb-2">{error}</p>
          <Link href="/product-gallery" className="text-primary text-sm hover:underline">← Kembali ke Etalase</Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#07070A] flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Pembayaran Berhasil!</h1>
          <p className="text-white/40 text-sm mb-6">Pesanan Anda telah dikonfirmasi.</p>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 mb-6 text-left">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-white/30">Invoice</span>
              <span className="text-white/70">{order?.invoiceNumber}</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-white/30">Total</span>
              <span className="text-primary font-semibold">{order ? formatPrice(order.totalAmount) : ''}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/30">Metode</span>
              <span className="text-white/70">{PAYMENT_METHODS.find(m => m.id === selectedMethod)?.label || 'Transfer'}</span>
            </div>
          </div>

          {publicToken && (
            <Link
              href={`/product-gallery/order/${publicToken}`}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm text-black transition-all"
              style={{ background: '#D4AF37' }}
            >
              Lihat Status Pesanan →
            </Link>
          )}
        </div>
      </div>
    );
  }

  const selectedMethodData = PAYMENT_METHODS.find(m => m.id === selectedMethod);

  return (
    <div className="min-h-screen bg-[#07070A] text-white">
      {/* Header */}
      <div className="bg-[#0D0D10] border-b border-white/[0.06]">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/product-gallery" className="text-white/30 hover:text-white/60">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-0.5">Pembayaran</p>
            <p className="text-xs text-white/35">DRW Prime</p>
          </div>
          <div className="w-6" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-5">
        {/* Order Summary */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white/60">Ringkasan Pesanan</h2>
            <span className="text-[10px] text-white/25 font-medium bg-white/5 px-2.5 py-1 rounded-full">{order?.invoiceNumber}</span>
          </div>

          {order && (
            <>
              <div className="space-y-2 mb-4">
                {order.items.slice(0, 2).map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-white/55 truncate flex-1 mr-3">
                      {item.productName}
                      <span className="text-white/20 ml-1">x{item.quantity}</span>
                    </span>
                    <span className="text-white/40">{formatPrice(item.subtotal)}</span>
                  </div>
                ))}
                {order.items.length > 2 && (
                  <button
                    onClick={() => setShowDetail(!showDetail)}
                    className="text-primary text-xs hover:underline"
                  >
                    {showDetail ? 'Sembunyikan' : `+ ${order.items.length - 2} produk lainnya`}
                  </button>
                )}
                {showDetail && order.items.slice(2).map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-white/55 truncate flex-1 mr-3">
                      {item.productName}
                      <span className="text-white/20 ml-1">x{item.quantity}</span>
                    </span>
                    <span className="text-white/40">{formatPrice(item.subtotal)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-white/[0.06] pt-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-white/25">Nama</span>
                  <span className="text-white/60">{order.customerName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/25">WhatsApp</span>
                  <span className="text-white/60">{order.customerPhone}</span>
                </div>
              </div>

              <div className="border-t border-white/[0.06] mt-3 pt-3 flex justify-between">
                <span className="text-white/40 font-semibold text-lg">Total</span>
                <span className="text-2xl font-bold text-primary">{formatPrice(order.totalAmount)}</span>
              </div>
            </>
          )}
        </div>

        {/* Payment Methods */}
        <div>
          <h3 className="text-sm font-bold text-white/50 mb-3">Pilih Metode Pembayaran</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PAYMENT_METHODS.map(method => (
              <button
                key={method.id}
                onClick={() => setSelectedMethod(method.id)}
                className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                  selectedMethod === method.id
                    ? 'border-primary/60 bg-primary/10 shadow-[0_0_20px_rgba(212,175,55,0.1)]'
                    : 'border-white/[0.06] bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
                }`}
              >
                <span className="text-2xl">{method.icon}</span>
                <div>
                  <p className={`text-sm font-semibold ${selectedMethod === method.id ? 'text-primary' : 'text-white/70'}`}>
                    {method.label}
                  </p>
                  <p className="text-[10px] text-white/25">Pembayaran instan</p>
                </div>
                {selectedMethod === method.id && (
                  <svg className="w-5 h-5 text-primary ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Payment Detail */}
        {selectedMethod && selectedMethodData && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white/50">Detail Pembayaran</h3>

            {selectedMethod.startsWith('dummy_va') ? (
              <div className="bg-black/50 rounded-xl border border-white/[0.08] p-4">
                <p className="text-xs text-white/30 mb-1">Nomor Virtual Account {selectedMethodData.bank}</p>
                <p className="text-xl font-bold tracking-[0.2em] text-white/90">{generateVaNumber(selectedMethodData.bank === 'BCA' ? '77208' : selectedMethodData.bank === 'Mandiri' ? '88908' : '98808')}</p>
                <p className="text-[10px] text-white/25 mt-2">Nomor ini hanya berlaku untuk 1 transaksi ini</p>
              </div>
            ) : selectedMethod === 'dummy_qris' ? (
              <div className="bg-black/50 rounded-xl border border-white/[0.08] p-4">
                <div className="w-40 h-40 mx-auto bg-white rounded-xl border-2 border-primary/20 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-4xl mb-1">📱</p>
                    <p className="text-[8px] font-mono text-black/50">{generateQrCode()}</p>
                  </div>
                </div>
                <p className="text-[10px] text-white/25 text-center mt-2">Scan QR dengan aplikasi e-wallet / mobile banking</p>
              </div>
            ) : (
              <div className="bg-black/50 rounded-xl border border-white/[0.08] p-4">
                <p className="text-xs text-white/30">Pembayaran via {selectedMethodData.label}</p>
                <p className="text-sm text-white/50 mt-1">Gunakan nomor invoice sebagai referensi transfer</p>
                <p className="text-xs font-mono text-primary/70 mt-2">{order?.invoiceNumber}</p>
              </div>
            )}

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
              <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-xs text-amber-400 font-semibold">Mode Dummy</p>
                <p className="text-[10px] text-amber-400/60">Ini adalah simulasi pembayaran. Klik &quot;Konfirmasi Pembayaran&quot; untuk mensimulasikan pembayaran berhasil.</p>
              </div>
            </div>

            <button
              onClick={handlePay}
              disabled={paying}
              className="w-full py-4 rounded-xl font-bold text-base text-black transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: '#D4AF37' }}
            >
              {paying ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Memproses...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  Konfirmasi Pembayaran ({formatPrice(order?.totalAmount || 0)})
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
