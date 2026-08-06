'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';

type ProductOrderItem = {
  id: string;
  productId: string;
  productName: string;
  productPrice: number;
  productSize: string | null;
  quantity: number;
  subtotal: number;
};

type ProductOrder = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingProvince: string | null;
  shippingPostal: string | null;
  notes: string | null;
  totalAmount: number;
  paymentStatus: string;
  orderStatus: string;
  paidAt: string | null;
  createdAt: string;
  items: ProductOrderItem[];
};

type ProductSummaryItem = {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
};

type ReportData = {
  orders: ProductOrder[];
  totals: {
    totalOrders: number;
    totalPendapatan: number;
    totalPaid: number;
    totalPending: number;
    totalFailed: number;
  };
  productSummary: ProductSummaryItem[];
};

export default function ReportProductDailyPage() {
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<ReportData>({ orders: [], totals: { totalOrders: 0, totalPendapatan: 0, totalPaid: 0, totalPending: 0, totalFailed: 0 }, productSummary: [] });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchingRef = useRef(false);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount || 0);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const fetchData = useCallback(async (dateFilter?: string, silent = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (!silent) setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (dateFilter) params.set('date', dateFilter);
      const response = await fetch(`/api/front-office/product-daily?${params.toString()}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal mengambil data');
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan saat mengambil data');
    } finally {
      if (!silent) setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    setSelectedDate(today);
    fetchData(today);
  }, [fetchData]);

  useEffect(() => {
    pollingRef.current = setInterval(() => {
      fetchData(selectedDate, true);
    }, 15000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [selectedDate, fetchData]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedDate]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
    fetchData(e.target.value);
  };

  const paidOrders = data.orders.filter(o => o.paymentStatus === 'paid');

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllPaid = () => {
    setSelectedIds(new Set(paidOrders.map(o => o.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleBatchDownload = async () => {
    if (selectedIds.size === 0) return;
    setDownloading(true);
    setDownloadError('');
    try {
      const res = await fetch('/api/front-office/product-orders/shipping-labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: [...selectedIds] }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal download');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shipping-labels-${selectedDate}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : 'Gagal download');
    } finally {
      setDownloading(false);
    }
  };

  const downloadSingle = (id: string, format: 'pdf' | 'jpg') => {
    const a = document.createElement('a');
    a.href = `/api/front-office/product-orders/${id}/shipping-label?format=${format}`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
  };

  const getPaymentStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      paid: 'bg-green-500/20 text-green-400',
      pending: 'bg-yellow-500/20 text-yellow-400',
      failed: 'bg-red-500/20 text-red-400',
      expired: 'bg-gray-500/20 text-gray-400',
      cancelled: 'bg-gray-500/20 text-gray-400',
      refunded: 'bg-blue-500/20 text-blue-400',
    };
    return `px-2 py-1 rounded text-xs font-semibold ${badges[status] || 'bg-white/10 text-white/60'}`;
  };

  const hasAddress = (o: ProductOrder) =>
    o.shippingAddress && o.shippingCity && o.shippingProvince && o.customerName && o.customerPhone;

  return (
    <main className="p-6 fo-theme-spending" style={{ backgroundColor: '#0a0a0f', minHeight: '100vh', color: '#e0e0e0' }}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <Link href="/front-office" className="text-blue-400 text-sm hover:underline mb-2 inline-block">
              &larr; Kembali ke Dashboard
            </Link>
            <h1 className="text-2xl font-bold">Laporan Penjualan Produk</h1>
            <p className="text-gray-400 text-sm mt-1">Label pengiriman tersedia untuk pesanan lunas</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
            />
            <button
              onClick={() => fetchData(selectedDate)}
              disabled={loading}
              className="fo-ios-btn fo-ios-btn-neutral text-sm"
              title="Refresh data"
            >
              {loading ? '...' : '↻'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-white/60">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-white/50 text-xs">Total Orders</p>
                <p className="text-white text-2xl font-bold mt-1">{data.totals.totalOrders}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-white/50 text-xs">Total Revenue</p>
                <p className="text-green-400 text-2xl font-bold mt-1">{formatCurrency(data.totals.totalPendapatan)}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-white/50 text-xs">Paid</p>
                <p className="text-green-400 text-2xl font-bold mt-1">{formatCurrency(data.totals.totalPaid)}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-white/50 text-xs">Pending</p>
                <p className="text-yellow-400 text-2xl font-bold mt-1">{data.totals.totalPending}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-white/50 text-xs">Failed/Cancelled</p>
                <p className="text-red-400 text-2xl font-bold mt-1">{data.totals.totalFailed}</p>
              </div>
            </div>

            {data.productSummary.length > 0 && (
              <div className="bg-white/5 rounded-xl border border-white/10 mb-8 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10">
                  <h2 className="text-white font-bold text-lg">Ringkasan per Produk (Lunas)</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white/5">
                      <tr className="text-left text-white/50 text-xs uppercase">
                        <th className="px-6 py-3">Produk</th>
                        <th className="px-6 py-3 text-right">Qty Siap Kirim</th>
                        <th className="px-6 py-3 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.productSummary.map((item) => (
                        <tr key={item.productId} className="border-t border-white/5 hover:bg-white/5">
                          <td className="px-6 py-3 text-white">{item.name}</td>
                          <td className="px-6 py-3 text-right text-white/80">{item.quantity}</td>
                          <td className="px-6 py-3 text-right text-green-400">{formatCurrency(item.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {paidOrders.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <button onClick={selectAllPaid} className="fo-ios-btn fo-ios-btn-neutral text-xs">
                  Pilih Semua Lunas ({paidOrders.length})
                </button>
                <button onClick={deselectAll} className="fo-ios-btn fo-ios-btn-neutral text-xs">
                  Hapus Pilihan
                </button>
                <button
                  onClick={handleBatchDownload}
                  disabled={selectedIds.size === 0 || downloading}
                  className="fo-ios-btn text-xs text-white disabled:opacity-40"
                  style={{ background: selectedIds.size > 0 ? '#D4AF37' : '#555' }}
                >
                  {downloading ? 'Membuat PDF...' : `Download ${selectedIds.size} Label (PDF)`}
                </button>
                {downloadError && <span className="text-red-400 text-xs">{downloadError}</span>}
              </div>
            )}

            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-white font-bold text-lg">Daftar Transaksi ({data.orders.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white/5">
                    <tr className="text-left text-white/50 text-xs uppercase">
                      <th className="px-3 py-3 w-8">#</th>
                      <th className="px-6 py-3">Invoice</th>
                      <th className="px-6 py-3">Customer</th>
                      <th className="px-6 py-3">Alamat</th>
                      <th className="px-6 py-3">Produk</th>
                      <th className="px-6 py-3 text-right">Total</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Tanggal</th>
                      <th className="px-6 py-3">Label</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orders.map((order) => {
                      const isPaid = order.paymentStatus === 'paid';
                      const completed = hasAddress(order);
                      return (
                        <tr key={order.id} className={`border-t border-white/5 ${isPaid ? 'hover:bg-white/5' : 'opacity-70'}`}>
                          <td className="px-3 py-3">
                            {isPaid && completed && (
                              <input
                                type="checkbox"
                                checked={selectedIds.has(order.id)}
                                onChange={() => toggleSelect(order.id)}
                                className="w-4 h-4 rounded accent-amber-500"
                              />
                            )}
                          </td>
                          <td className="px-6 py-3 text-blue-400 font-mono text-xs">{order.invoiceNumber}</td>
                          <td className="px-6 py-3 text-white">
                            <p className="font-semibold">{order.customerName}</p>
                            <p className="text-white/40 text-xs">{order.customerPhone}</p>
                          </td>
                          <td className="px-6 py-3 text-white/60 text-xs">
                            {order.shippingAddress && (
                              <p>{order.shippingAddress}, {order.shippingCity}, {order.shippingProvince} {order.shippingPostal || ''}</p>
                            )}
                          </td>
                          <td className="px-6 py-3 text-white/70 text-xs">
                            {order.items.map((item, i) => (
                              <p key={i}>{item.productName} x{item.quantity}</p>
                            ))}
                          </td>
                          <td className="px-6 py-3 text-right text-white font-semibold">
                            {formatCurrency(Number(order.totalAmount))}
                          </td>
                          <td className="px-6 py-3">
                            <span className={getPaymentStatusBadge(order.paymentStatus)}>
                              {order.paymentStatus}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-white/50 text-xs">{formatDate(order.createdAt)}</td>
                          <td className="px-3 py-3">
                            {isPaid && completed ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => downloadSingle(order.id, 'pdf')}
                                  className="text-[10px] px-2 py-1 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 font-semibold"
                                >
                                  PDF
                                </button>
                                <button
                                  onClick={() => downloadSingle(order.id, 'jpg')}
                                  className="text-[10px] px-2 py-1 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 font-semibold"
                                >
                                  JPG
                                </button>
                              </div>
                            ) : isPaid && !completed ? (
                              <span className="text-[10px] text-red-400">Alamat tidak lengkap</span>
                            ) : (
                              <span className="text-[10px] text-white/25">Menunggu Pembayaran</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {data.orders.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-6 py-12 text-center text-white/40">
                          Belum ada transaksi untuk tanggal ini
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
