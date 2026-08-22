'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Hourglass } from '@/components/LoadingScreen';

type UploadItem = {
  id: string;
  reportDate: string;
  sourceFileName: string;
  totalRows: number;
  totalPendapatan: number;
  totalKeuntungan: number;
  createdAt: string;
  entryCount: number;
};

type CustomerSummary = {
  namaPasien: string;
  totalKunjungan: number;
  totalPendapatan: number;
  totalKeuntungan: number;
  lastVisit: string;
};

type DashboardData = {
  uploads: UploadItem[];
  customerSummaries: CustomerSummary[];
  scanRecords: ScanRecord[];
  aidoRecords: AidoRecord[];
  aidoSummary: {
    totalRows: number;
    totalPendapatan: number;
    matchedRows: number;
    unmatchedRows: number;
  };
  totals: {
    totalPendapatan: number;
    totalKeuntungan: number;
    totalKunjungan: number;
  };
};

type ScanRecord = {
  id: string;
  namaPasien: string;
  treatment: string | null;
  amount: number;
  spendingDate: string;
};

type AidoRecord = {
  id: string;
  namaPasien: string;
  treatment: string | null;
  amount: number;
  transactionDate: string;
  matchStatus: string;
  matchedUserId: string | null;
};

export default function ReportSpendingDailyPage() {

  const [selectedDate, setSelectedDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [data, setData] = useState<DashboardData>({
    uploads: [],
    customerSummaries: [],
    scanRecords: [],
    aidoRecords: [],
    aidoSummary: { totalRows: 0, totalPendapatan: 0, matchedRows: 0, unmatchedRows: 0 },
    totals: { totalPendapatan: 0, totalKeuntungan: 0, totalKunjungan: 0 },
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const fetchData = async (dateFilter?: string) => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (dateFilter) params.set('date', dateFilter);

      const response = await fetch(`/api/front-office/spending-daily?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gagal mengambil data spending');
      }

      setData({
        uploads: result.uploads || [],
        customerSummaries: result.customerSummaries || [],
        scanRecords: result.scanRecords || [],
        aidoRecords: result.aidoRecords || [],
        aidoSummary: result.aidoSummary || {
          totalRows: 0,
          totalPendapatan: 0,
          matchedRows: 0,
          unmatchedRows: 0,
        },
        totals: result.totals || { totalPendapatan: 0, totalKeuntungan: 0, totalKunjungan: 0 },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan saat mengambil data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedDate);
  }, [selectedDate]);

  const handleUpload = async () => {
    if (!file) {
      setError('Pilih file Excel terlebih dahulu');
      return;
    }

    setUploading(true);
    setError('');
    setSuccessMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (selectedDate) {
        formData.append('reportDate', selectedDate);
      }

      const response = await fetch('/api/front-office/spending-daily', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Upload gagal');
      }

      setSuccessMessage(result.message || `Upload berhasil: ${result.upload.totalRows} baris diproses.`);
      setFile(null);

      const input = document.getElementById('spending-file-input') as HTMLInputElement | null;
      if (input) input.value = '';

      await fetchData(selectedDate);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan saat upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id?: string) => {
    const isAll = !id;
    const confirmMsg = isAll
      ? 'Hapus SEMUA riwayat upload spending? Tindakan ini permanen dan tidak bisa dibatalkan.'
      : 'Hapus upload ini? Semua entri terkait ikut terhapus permanen.';
    if (!window.confirm(confirmMsg)) return;

    setDeletingId(isAll ? 'all' : id);
    setError('');
    setSuccessMessage('');

    try {
      const query = isAll ? 'all=true' : `id=${encodeURIComponent(id)}`;
      const response = await fetch(`/api/front-office/spending-daily?${query}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gagal menghapus data');
      }

      setSuccessMessage(result.message || 'Data berhasil dihapus.');
      await fetchData(selectedDate);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan saat menghapus data');
    } finally {
      setDeletingId(null);
    }
  };

  const totalCustomer = useMemo(() => data.customerSummaries.length, [data.customerSummaries.length]);

  if (loading) {
    return (
      <div className="min-h-screen fo-glass-page fo-theme-spending">
        <div className="pt-24 flex items-center justify-center">
          <p className="text-white/60">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen fo-glass-page fo-theme-spending">
      <div className="pt-20 pb-10">
          <div className="max-w-7xl mx-auto px-4 py-6 fo-fade-up">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white">Report Spending Daily</h1>
                <p className="text-white/60 text-sm">Upload harian data spending customer untuk kebutuhan membership</p>
              </div>
              <Link
                href="/front-office"
                className="fo-nav-chip text-sm"
              >
                Kembali ke Front Office
              </Link>
            </div>

            <div className="fo-glass-card fo-fade-up fo-stagger-1 rounded-xl p-4 md:p-6 mb-6">
              <h2 className="text-white font-semibold mb-4">Upload File Harian (.xlsx)</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-white/70 text-sm mb-2">Tanggal Report (opsional)</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full fo-glass-input rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-white/70 text-sm mb-2">Pilih file VisitReport</label>
                  <input
                    id="spending-file-input"
                    type="file"
                    accept=".xlsx"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="w-full fo-glass-input rounded-lg px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary/20 file:px-3 file:py-1.5 file:text-primary"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-4">
                <button
                  onClick={handleUpload}
                  disabled={uploading || !file}
                  className="fo-glass-card-soft border-primary/35 text-primary px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/20 transition-colors"
                >
                  {uploading ? 'Uploading...' : 'Upload Report'}
                </button>

                {file && <p className="text-white/60 text-xs">File: {file.name}</p>}
              </div>

              {error && (
                <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              {successMessage && (
                <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-300">
                  {successMessage}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
              <div className="fo-glass-card fo-fade-up fo-stagger-1 rounded-xl p-5 border-primary/35">
                <p className="text-primary text-xs mb-1">Total Customer</p>
                <p className="text-2xl font-bold text-white">{totalCustomer}</p>
              </div>
              <div className="fo-glass-card fo-fade-up fo-stagger-2 rounded-xl p-5 border-green-500/35">
                <p className="text-green-400 text-xs mb-1">Total Pendapatan</p>
                <p className="text-xl font-bold text-white">{formatCurrency(data.totals.totalPendapatan)}</p>
              </div>
              <div className="fo-glass-card fo-fade-up fo-stagger-3 rounded-xl p-5 border-blue-500/35">
                <p className="text-blue-400 text-xs mb-1">Total Keuntungan</p>
                <p className="text-xl font-bold text-white">{formatCurrency(data.totals.totalKeuntungan)}</p>
              </div>
              <div className="fo-glass-card fo-fade-up fo-stagger-4 rounded-xl p-5 border-yellow-500/35">
                <p className="text-yellow-300 text-xs mb-1">Total Kunjungan</p>
                <p className="text-2xl font-bold text-white">{data.totals.totalKunjungan}</p>
              </div>
              <div className="fo-glass-card fo-fade-up fo-stagger-4 rounded-xl p-5 border-cyan-500/35">
                <p className="text-cyan-300 text-xs mb-1">Omzet AIDO</p>
                <p className="text-xl font-bold text-white">{formatCurrency(data.aidoSummary.totalPendapatan)}</p>
              </div>
              <div className="fo-glass-card fo-fade-up fo-stagger-4 rounded-xl p-5 border-orange-500/35">
                <p className="text-orange-300 text-xs mb-1">AIDO Perlu Review</p>
                <p className="text-2xl font-bold text-white">{data.aidoSummary.unmatchedRows}</p>
              </div>
            </div>

            <div className="fo-glass-card fo-fade-up fo-stagger-2 rounded-xl overflow-hidden mb-6">
              <div className="p-4 border-b border-white/10 fo-glass-card-soft flex items-center justify-between gap-3">
                <h3 className="text-white font-semibold">Income AIDO</h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 whitespace-nowrap">
                  {data.aidoSummary.matchedRows}/{data.aidoSummary.totalRows} terhubung ke member
                </span>
              </div>

              {data.aidoRecords.length === 0 ? (
                <div className="p-8 text-center text-white/60">Belum ada income AIDO</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="fo-glass-card-soft border-b border-white/10">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">No</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Nama Pasien</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Treatment</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Nominal</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Tanggal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {data.aidoRecords.slice(0, 100).map((income, idx) => (
                        <tr key={income.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 text-sm text-white/70">{idx + 1}</td>
                          <td className="px-4 py-3 text-sm text-white">{income.namaPasien}</td>
                          <td className="px-4 py-3 text-sm text-white/70">{income.treatment || '-'}</td>
                          <td className="px-4 py-3 text-sm text-cyan-200 font-semibold">{formatCurrency(income.amount)}</td>
                          <td className="px-4 py-3 text-sm text-white/70">{income.matchStatus}</td>
                          <td className="px-4 py-3 text-sm text-white/60 whitespace-nowrap">{formatDate(income.transactionDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="fo-glass-card fo-fade-up fo-stagger-2 rounded-xl overflow-hidden mb-6">
              <div className="p-4 border-b border-white/10 fo-glass-card-soft">
                <h3 className="text-white font-semibold">Top Customer Spending</h3>
              </div>

              {loading ? (
                <div className="p-8 text-center text-white/60">Loading data...</div>
              ) : data.customerSummaries.length === 0 ? (
                <div className="p-8 text-center text-white/60">Belum ada data spending customer</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="fo-glass-card-soft border-b border-white/10">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">No</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Nama Pasien</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Total Kunjungan</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Total Pendapatan</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Total Keuntungan</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Last Visit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {data.customerSummaries.map((item, idx) => (
                        <tr key={`${item.namaPasien}-${idx}`} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 text-sm text-white/70">{idx + 1}</td>
                          <td className="px-4 py-3 text-sm text-white">{item.namaPasien}</td>
                          <td className="px-4 py-3 text-sm text-white/80">{item.totalKunjungan}</td>
                          <td className="px-4 py-3 text-sm text-green-300 font-semibold">{formatCurrency(item.totalPendapatan)}</td>
                          <td className="px-4 py-3 text-sm text-blue-300">{formatCurrency(item.totalKeuntungan)}</td>
                          <td className="px-4 py-3 text-sm text-white/60">{formatDate(item.lastVisit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Riwayat Spending (Scan) — sumber utama real-time */}
            <div className="fo-glass-card fo-fade-up fo-stagger-2 rounded-xl overflow-hidden mb-6">
              <div className="p-4 border-b border-white/10 fo-glass-card-soft flex items-center justify-between gap-3">
                <h3 className="text-white font-semibold">Spending dari Scan</h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 whitespace-nowrap">Real-time · sumber utama</span>
              </div>

              {loading ? (
                <div className="p-8 text-center flex justify-center"><Hourglass size={44} /></div>
              ) : data.scanRecords.length === 0 ? (
                <div className="p-8 text-center text-white/60">Belum ada spending hasil scan</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="fo-glass-card-soft border-b border-white/10">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">No</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Nama Member</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Treatment</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Nominal</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Tanggal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {data.scanRecords.map((s, idx) => (
                        <tr key={s.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 text-sm text-white/70">{idx + 1}</td>
                          <td className="px-4 py-3 text-sm text-white">{s.namaPasien}</td>
                          <td className="px-4 py-3 text-sm text-white/70">{s.treatment || '-'}</td>
                          <td className="px-4 py-3 text-sm text-green-300 font-semibold">{formatCurrency(s.amount)}</td>
                          <td className="px-4 py-3 text-sm text-white/60 whitespace-nowrap">{formatDate(s.spendingDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="fo-glass-card fo-fade-up fo-stagger-3 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-white/10 fo-glass-card-soft flex items-center justify-between gap-3">
                <h3 className="text-white font-semibold">Riwayat Upload</h3>
                {data.uploads.length > 0 && (
                  <button
                    onClick={() => handleDelete()}
                    disabled={deletingId !== null}
                    className="fo-glass-card-soft border-red-500/35 text-red-300 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {deletingId === 'all' ? 'Menghapus...' : 'Hapus Semua'}
                  </button>
                )}
              </div>

              {loading ? (
                <div className="p-8 text-center text-white/60">Loading upload history...</div>
              ) : data.uploads.length === 0 ? (
                <div className="p-8 text-center text-white/60">Belum ada upload report</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="fo-glass-card-soft border-b border-white/10">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Tanggal Report</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Nama File</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Rows</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Total Pendapatan</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Diupload</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-white/70">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {data.uploads.map((item) => (
                        <tr key={item.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 text-sm text-white/80">{formatDate(item.reportDate)}</td>
                          <td className="px-4 py-3 text-sm text-white/70">{item.sourceFileName}</td>
                          <td className="px-4 py-3 text-sm text-white/80">{item.entryCount}</td>
                          <td className="px-4 py-3 text-sm text-green-300">{formatCurrency(item.totalPendapatan)}</td>
                          <td className="px-4 py-3 text-sm text-white/60">{formatDate(item.createdAt)}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            <button
                              onClick={() => handleDelete(item.id)}
                              disabled={deletingId !== null}
                              className="fo-glass-card-soft border-red-500/35 text-red-300 px-2.5 py-1 rounded-md text-xs font-semibold hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              {deletingId === item.id ? '...' : 'Hapus'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
    </div>
  );
}
