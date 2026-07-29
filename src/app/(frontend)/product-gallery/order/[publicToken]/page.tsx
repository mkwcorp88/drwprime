'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled' | 'refunded';

interface OrderStatus {
  invoiceNumber: string;
  paymentStatus: PaymentStatus;
  orderStatus: string;
  totalAmount: number;
  paymentUrl: string | null;
  paidAt: string | null;
  createdAt: string;
  items: { productName: string; productPrice: number; quantity: number; subtotal: number; productSize: string | null }[];
}

const STATUS_MAP: Record<PaymentStatus, { label: string; color: string; bg: string; icon: string }> = {
  pending: { label: 'Menunggu Pembayaran', color: 'text-amber-400', bg: 'bg-amber-400/10', icon: 'clock' },
  paid: { label: 'Pembayaran Berhasil', color: 'text-emerald-400', bg: 'bg-emerald-400/10', icon: 'check' },
  failed: { label: 'Pembayaran Gagal', color: 'text-red-400', bg: 'bg-red-400/10', icon: 'x' },
  expired: { label: 'Pembayaran Kedaluwarsa', color: 'text-slate-400', bg: 'bg-slate-400/10', icon: 'x' },
  cancelled: { label: 'Dibatalkan', color: 'text-slate-400', bg: 'bg-slate-400/10', icon: 'x' },
  refunded: { label: 'Dikembalikan', color: 'text-blue-400', bg: 'bg-blue-400/10', icon: 'check' },
};

const TERMINAL_STATUSES: PaymentStatus[] = ['paid', 'failed', 'expired', 'cancelled', 'refunded'];

function StatusIcon({ status, className }: { status: PaymentStatus; className?: string }) {
  if (status === 'pending') {
    return (
      <svg className={`w-10 h-10 animate-pulse ${className || ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
      </svg>
    );
  }
  if (status === 'paid' || status === 'refunded') {
    return (
      <svg className={`w-10 h-10 ${className || ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  return (
    <svg className={`w-10 h-10 ${className || ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export default function OrderStatusPage() {
  const { publicToken } = useParams<{ publicToken: string }>();
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const hasTerminalRef = useRef(false);

  useEffect(() => {
    if (!publicToken) return;

    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/products/orders/${publicToken}`);
        const data = await res.json();
        if (!res.ok) {
          setFetchError(data.error || 'Gagal memuat status pesanan');
          setLoading(false);
          return;
        }
        setOrder(data.order);
        setFetchError('');
        setLoading(false);

        if (TERMINAL_STATUSES.includes(data.order.paymentStatus)) {
          hasTerminalRef.current = true;
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch (e) {
        if (!order) setFetchError('Gagal menghubungi server');
      }
    };

    fetchOrder();

    pollRef.current = setInterval(() => {
      if (!hasTerminalRef.current) fetchOrder();
    }, 5000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [publicToken]);

  const formatPrice = (p: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(p);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07070A] flex items-center justify-center">
        <p className="text-white/30">Memuat status pesanan...</p>
      </div>
    );
  }

  if (fetchError || !order) {
    return (
      <div className="min-h-screen bg-[#07070A] flex items-center justify-center px-5">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-red-400 font-medium mb-2">{fetchError || 'Pesanan tidak ditemukan'}</p>
          <Link href="/product-gallery" className="text-primary text-sm hover:underline">← Kembali ke Etalase</Link>
        </div>
      </div>
    );
  }

  const status = STATUS_MAP[order.paymentStatus] || STATUS_MAP.pending;
  const isTerminal = TERMINAL_STATUSES.includes(order.paymentStatus);
  const canPay = order.paymentStatus === 'pending' && order.paymentUrl;
  const isSuccess = order.paymentStatus === 'paid';

  return (
    <div className="min-h-screen bg-[#07070A]">
      <div className="max-w-lg mx-auto px-5 py-12 lg:py-20">
        <div className="text-center mb-8">
          <div className={`w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center ${status.bg}`}>
            <StatusIcon status={order.paymentStatus} className={status.color} />
          </div>
          <h1 className={`text-2xl font-bold mb-2 ${status.color}`}>{status.label}</h1>
          <p className="text-white/30 text-xs">{order.invoiceNumber}</p>
          {order.createdAt && (
            <p className="text-white/20 text-xs mt-1">{formatDate(order.createdAt)}</p>
          )}
        </div>

        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 mb-6">
          <h2 className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">Rincian Pesanan</h2>
          <div className="space-y-3">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-white/70 truncate">{item.productName}</p>
                  {item.productSize && <p className="text-white/20 text-[10px]">{item.productSize} x{item.quantity}</p>}
                </div>
                <p className="text-white/50 font-medium ml-4">{formatPrice(item.subtotal)}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-white/[0.06] mt-4 pt-4 flex justify-between">
            <span className="text-white/40 font-semibold text-sm">Total</span>
            <span className="text-lg font-bold text-primary">{formatPrice(order.totalAmount)}</span>
          </div>
        </div>

        {canPay && (
          <a
            href={order.paymentUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-4 rounded-xl font-bold text-center text-sm text-black mb-4 transition-all hover:shadow-xl active:scale-[0.98]"
            style={{ background: '#D4AF37' }}
          >
            Lanjutkan Pembayaran
          </a>
        )}

        {isSuccess && order.paidAt && (
          <p className="text-center text-white/25 text-xs mb-4">Dibayar pada {formatDate(order.paidAt)}</p>
        )}

        {isTerminal && order.paymentStatus === 'failed' && (
          <div className="text-center mb-4">
            <Link
              href="/product-gallery"
              className="inline-block px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm font-medium hover:bg-white/10 transition-colors"
            >
              Pesan Ulang →
            </Link>
          </div>
        )}

        <div className="text-center">
          <Link href="/product-gallery" className="text-white/25 hover:text-white/50 text-sm">← Kembali ke Etalase</Link>
        </div>
      </div>
    </div>
  );
}
