'use client';

import { useEffect, useState } from 'react';
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
  customerEmail: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingProvince: string | null;
  shippingPostal: string | null;
  notes: string | null;
  totalAmount: number;
  paymentStatus: string;
  orderStatus: string;
  paymentUrl: string | null;
  paymentType: string | null;
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

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount || 0);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const fetchData = async (dateFilter?: string) => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
    fetchData(today);
  }, []);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
    fetchData(e.target.value);
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

  return (
    <main className="p-6 fo-theme-spending" style={{ backgroundColor: '#0a0a0f', minHeight: '100vh', color: '#e0e0e0' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/front-office" className="text-blue-400 text-sm hover:underline mb-2 inline-block">
              &larr; Kembali ke Dashboard
            </Link>
            <h1 className="text-2xl font-bold">Daily Product Sales Report</h1>
            <p className="text-gray-400 text-sm mt-1">Laporan penjualan produk harian via DOKU payment</p>
          </div>
          <div>
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
            />
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
            {/* Summary Cards */}
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

            {/* Product Summary Table */}
            {data.productSummary.length > 0 && (
              <div className="bg-white/5 rounded-xl border border-white/10 mb-8 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10">
                  <h2 className="text-white font-bold text-lg">Ringkasan per Produk</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white/5">
                      <tr className="text-left text-white/50 text-xs uppercase">
                        <th className="px-6 py-3">Produk</th>
                        <th className="px-6 py-3 text-right">Qty Terjual</th>
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

            {/* Orders Table */}
            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10">
                <h2 className="text-white font-bold text-lg">Daftar Transaksi ({data.orders.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white/5">
                    <tr className="text-left text-white/50 text-xs uppercase">
                      <th className="px-6 py-3">Invoice</th>
                      <th className="px-6 py-3">Customer</th>
                      <th className="px-6 py-3">Alamat</th>
                      <th className="px-6 py-3">Produk</th>
                      <th className="px-6 py-3 text-right">Total</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orders.map((order) => (
                      <tr key={order.id} className="border-t border-white/5 hover:bg-white/5">
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
                      </tr>
                    ))}
                    {data.orders.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-white/40">
                          Belum ada transaksi produk untuk tanggal ini
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
