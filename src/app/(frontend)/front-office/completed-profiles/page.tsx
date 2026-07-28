'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ExcelJS from 'exceljs';
import { Hourglass } from '@/components/LoadingScreen';

interface CompletedProfile {
  firstName: string;
  lastName: string;
  email: string;
  affiliateCode: string;
  phone: string;
  nik: string;
  gender: string;
  dateOfBirth: string | null;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  profileCompletedAt: string | null;
  points: number;
  loyaltyPoints: number;
  loyaltyLevel: string;
  totalEarnings: number;
  totalReferrals: number;
  lastTransaction: { date: string; description: string } | null;
  lastReservation: { date: string; treatment: string; status: string } | null;
}

export default function CompletedProfilesPage() {
  const [profiles, setProfiles] = useState<CompletedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<CompletedProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'profil' | 'riwayat'>('profil');
  const [riwayatTindakan, setRiwayatTindakan] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [riwayatSummary, setRiwayatSummary] = useState<{ medicalCount: number; spendingCount: number; totalSpending: number; points: number } | null>(null);
  const [loadingRiwayat, setLoadingRiwayat] = useState(false);
  const [totalMembers, setTotalMembers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchProfiles(currentPage, debouncedSearch);
  }, [currentPage, debouncedSearch]);

  const fetchProfiles = async (page: number, search: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: search,
      });
      const response = await fetch(`/api/front-office/members?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch members');
      const data = await response.json();
      setProfiles(data.members || []);
      setTotalMembers(data.total || 0);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setCurrentPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 500);
  };

  const totalPages = Math.ceil(totalMembers / limit);

  const fetchRiwayatTindakan = async (userId: string) => {
    setLoadingRiwayat(true);
    try {
      const res = await fetch(`/api/front-office/riwayat-tindakan?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setTimeline(data.timeline || []);
      setRiwayatSummary({
        medicalCount: data.medicalCount ?? 0,
        spendingCount: data.spendingCount ?? 0,
        totalSpending: data.totalSpending ?? 0,
        points: data.points ?? 0,
      });
    } catch (error) {
      console.error('Error fetching riwayat tindakan:', error);
    } finally {
      setLoadingRiwayat(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getLastActivity = (p: CompletedProfile) => {
    if (p.lastTransaction) return p.lastTransaction.description;
    if (p.lastReservation) return `Reservasi: ${p.lastReservation.treatment}`;
    return '-';
  };

  const getLastActivityDate = (p: CompletedProfile) => {
    const dates: Date[] = [];
    if (p.lastTransaction) dates.push(new Date(p.lastTransaction.date));
    if (p.lastReservation) dates.push(new Date(p.lastReservation.date));
    if (p.profileCompletedAt) dates.push(new Date(p.profileCompletedAt));
    if (dates.length === 0) return '-';
    const latest = new Date(Math.max(...dates.map(d => d.getTime())));
    return latest.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Membership Profil');

    worksheet.columns = [
      { header: 'Nama', key: 'nama', width: 25 },
      { header: 'Email', key: 'email', width: 32 },
      { header: 'No. HP', key: 'phone', width: 18 },
      { header: 'Jenis Kelamin', key: 'gender', width: 14 },
      { header: 'Tanggal Lahir', key: 'dob', width: 16 },
      { header: 'NIK', key: 'nik', width: 22 },
      { header: 'Alamat', key: 'address', width: 40 },
      { header: 'Kota', key: 'city', width: 18 },
      { header: 'Provinsi', key: 'province', width: 20 },
      { header: 'Kode Afiliasi', key: 'affiliateCode', width: 14 },
      { header: 'Poin', key: 'points', width: 10 },
      { header: 'Level', key: 'level', width: 12 },
      { header: 'Pendapatan', key: 'earnings', width: 18 },
      { header: 'Tanggal Melengkapi', key: 'completedAt', width: 18 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD4AF37' },
    };

    profiles.forEach((p) => {
      worksheet.addRow({
        nama: `${p.firstName} ${p.lastName}`.trim(),
        email: p.email,
        phone: p.phone,
        gender: p.gender,
        dob: formatDate(p.dateOfBirth),
        nik: p.nik,
        address: p.address,
        city: p.city,
        province: p.province,
        affiliateCode: p.affiliateCode,
        points: p.points,
        level: p.loyaltyLevel,
        earnings: formatCurrency(p.totalEarnings),
        completedAt: formatDate(p.profileCompletedAt),
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Report_Profil_Lengkap_${new Date().toISOString().split('T')[0]}.xlsx`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen fo-glass-page fo-theme-dashboard">
        <div className="pt-20 flex items-center justify-center">
          <Hourglass size={56} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen fo-glass-page fo-theme-dashboard">
      <div className="pt-20">
        <div className="max-w-7xl mx-auto px-4 py-6 fo-fade-up">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="font-playfair text-2xl md:text-3xl font-bold text-primary mb-1">
                  Membership Profil
                </h1>
                <p className="text-white/60 text-sm">
                  Daftar member yang sudah melengkapi profil di My Prime
                </p>
              </div>
              <button
                onClick={exportToExcel}
                disabled={profiles.length === 0}
                className="fo-glass-card-soft border-green-500/35 text-green-300 px-4 py-2 rounded-lg hover:bg-green-500/20 transition-colors text-sm font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export Excel
              </button>
            </div>
          </div>

          {/* Total Count Card & Search */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="fo-glass-card fo-fade-up fo-stagger-1 rounded-xl p-6 border-primary/40">
              <div className="text-center">
                <p className="text-white/70 text-sm mb-2">Total Semua Member</p>
                <p className="font-playfair text-5xl font-bold text-primary mb-1">{totalMembers.toLocaleString('id-ID')}</p>
                <p className="text-white/50 text-xs">orang</p>
              </div>
            </div>
            <div className="md:col-span-2 fo-glass-card fo-fade-up fo-stagger-2 rounded-xl p-6 flex flex-col justify-center">
              <label htmlFor="search" className="text-white/70 text-sm mb-2 font-semibold">Cari Member</label>
              <input
                id="search"
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Ketik nama atau nomor HP..."
                className="w-full bg-black/20 text-white border border-white/20 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          {/* Profiles Table */}
          <div className="fo-glass-card fo-fade-up fo-stagger-2 rounded-xl overflow-hidden">
            <div className="fo-glass-card-soft border-b border-primary/30 p-4">
              <h2 className="font-bold text-white">Daftar Member</h2>
            </div>

            {profiles.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-white/60">Belum ada member yang melengkapi profil</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="fo-glass-card-soft border-b border-white/10">
                    <tr>
                      <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-white/50 uppercase tracking-wider">No. RM</th>
                      <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-white/50 uppercase tracking-wider">Nama</th>
                      <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-white/50 uppercase tracking-wider">No. HP</th>
                      <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-white/50 uppercase tracking-wider">Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {profiles.map((p, index) => (
                      <tr
                        key={`${p.email}-${index}`}
                        onClick={() => {
                          setSelectedProfile(p);
                          setActiveTab('profil');
                          const uid = (p as any).id;
                          if (uid) fetchRiwayatTindakan(uid);
                        }}
                        className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                      >
                        <td className="px-5 py-3.5 text-sm text-white/60 font-mono group-hover:text-white/90 transition-colors">
                          {(p as any).nomorRekamMedis || '-'}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-white font-medium whitespace-nowrap">
                          {p.firstName} {p.lastName}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-white/60 whitespace-nowrap font-mono">
                          {p.phone || '-'}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${getLevelColor(p.loyaltyLevel)}`}>
                            {p.loyaltyLevel}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
            <div className="fo-glass-card-soft border-t border-primary/30 p-4 flex items-center justify-between">
              <span className="text-sm text-white/60">
                Halaman {currentPage} dari {totalPages} ({totalMembers} member)
              </span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm rounded-md bg-black/20 hover:bg-black/40 disabled:opacity-50"
                >
                  Sebelumnya
                </button>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm rounded-md bg-black/20 hover:bg-black/40 disabled:opacity-50"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Detail Panel */}
      {selectedProfile && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => { setSelectedProfile(null); setActiveTab('profil'); }}
          />
          <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-[#0a0a0f] border-l border-white/10 shadow-2xl z-50 overflow-y-auto animate-slide-left">
            <div className="sticky top-0 bg-[#0a0a0f]/95 backdrop-blur-xl border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab('profil')}
                  className={`text-sm font-bold pb-1.5 border-b-2 transition-colors ${
                    activeTab === 'profil'
                      ? 'text-primary border-primary'
                      : 'text-white/40 border-transparent hover:text-white/70'
                  }`}
                >
                  Profil
                </button>
                <button
                  onClick={() => {
                    setActiveTab('riwayat');
                    const uid = (selectedProfile as any).id;
                    if (uid && timeline.length === 0) fetchRiwayatTindakan(uid);
                  }}
                  className={`text-sm font-bold pb-1.5 border-b-2 transition-colors ${
                    activeTab === 'riwayat'
                      ? 'text-primary border-primary'
                      : 'text-white/40 border-transparent hover:text-white/70'
                  }`}
                >
                  Riwayat
                </button>
              </div>
              <button
                onClick={() => { setSelectedProfile(null); setActiveTab('profil'); }}
                className="text-white/40 hover:text-white transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
            {activeTab === 'profil' ? (
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-4 space-y-3">
                <h4 className="text-primary font-bold text-[11px] uppercase tracking-widest">Informasi Dasar</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">Nama</p>
                    <p className="text-white font-semibold">{selectedProfile.firstName} {selectedProfile.lastName}</p>
                  </div>
                  <div>
                    <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">Gender</p>
                    <p className="text-white">{selectedProfile.gender || '-'}</p>
                  </div>
                  <div>
                    <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">Tgl Lahir</p>
                    <p className="text-white">{formatDate(selectedProfile.dateOfBirth)}</p>
                  </div>
                  <div>
                    <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">NIK</p>
                    <p className="text-white font-mono text-xs">{selectedProfile.nik || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-4 space-y-3">
                <h4 className="text-primary font-bold text-[11px] uppercase tracking-widest">Kontak</h4>
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-white/30 text-[10px] uppercase tracking-wider">Email</span>
                    <span className="text-white text-xs break-all max-w-[60%] text-right">{selectedProfile.email}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/30 text-[10px] uppercase tracking-wider">No. HP</span>
                    <span className="text-white font-mono">{selectedProfile.phone || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Medical Record */}
              {(selectedProfile as any).nomorRekamMedis && (
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-4 space-y-3">
                <h4 className="text-primary font-bold text-[11px] uppercase tracking-widest">Rekam Medis</h4>
                <div>
                  <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">No. RM</p>
                  <p className="text-white font-mono font-bold text-lg">{(selectedProfile as any).nomorRekamMedis}</p>
                </div>
              </div>
              )}

              {/* Address */}
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-4 space-y-3">
                <h4 className="text-primary font-bold text-[11px] uppercase tracking-widest">Alamat</h4>
                <div className="space-y-2.5 text-sm">
                  <div>
                    <p className="text-white/30 text-[10px] uppercase tracking-wider mb-0.5">Alamat</p>
                    <p className="text-white text-xs leading-relaxed">{selectedProfile.address || '-'}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-white/30 text-[10px] uppercase tracking-wider mb-0.5">Kota</p>
                      <p className="text-white text-xs">{selectedProfile.city || '-'}</p>
                    </div>
                    <div>
                      <p className="text-white/30 text-[10px] uppercase tracking-wider mb-0.5">Provinsi</p>
                      <p className="text-white text-xs">{selectedProfile.province || '-'}</p>
                    </div>
                    <div>
                      <p className="text-white/30 text-[10px] uppercase tracking-wider mb-0.5">Kode Pos</p>
                      <p className="text-white text-xs">{selectedProfile.postalCode || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Membership */}
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-4 space-y-3">
                <h4 className="text-primary font-bold text-[11px] uppercase tracking-widest">Membership</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">Kode Afiliasi</p>
                    <p className="text-white font-mono font-bold">{selectedProfile.affiliateCode}</p>
                  </div>
                  <div>
                    <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">Level</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${getLevelColor(selectedProfile.loyaltyLevel)}`}>
                      {selectedProfile.loyaltyLevel}
                    </span>
                  </div>
                  <div>
                    <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">Poin</p>
                    <p className="text-primary font-bold">{(selectedProfile.points || 0).toLocaleString('id-ID')}</p>
                  </div>
                  <div>
                    <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">Pendapatan</p>
                    <p className="text-green-400 font-semibold">{formatCurrency(selectedProfile.totalEarnings || 0)}</p>
                  </div>
                </div>
              </div>

              <div className="text-center text-white/20 text-[10px] pt-1">
                Profil dilengkapi {formatDate(selectedProfile.profileCompletedAt)}
              </div>
            </div>
            ) : (
            <div className="space-y-4">
              {riwayatSummary && (
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-3 text-center">
                    <p className="text-primary font-bold text-lg">{riwayatSummary.spendingCount + riwayatSummary.medicalCount}</p>
                    <p className="text-white/30 text-[10px] uppercase tracking-wider">Aktivitas</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-3 text-center">
                    <p className="text-green-400 font-bold text-sm">Rp {riwayatSummary.totalSpending.toLocaleString('id-ID')}</p>
                    <p className="text-white/30 text-[10px] uppercase tracking-wider">Spending</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-3 text-center">
                    <p className="text-primary font-bold text-lg">{riwayatSummary.points.toLocaleString('id-ID')}</p>
                    <p className="text-white/30 text-[10px] uppercase tracking-wider">Poin</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-3 text-center">
                    <p className="text-white font-bold text-lg">{riwayatSummary.spendingCount}</p>
                    <p className="text-white/30 text-[10px] uppercase tracking-wider">Transaksi</p>
                  </div>
                </div>
              )}

              <h4 className="text-primary font-bold text-[11px] uppercase tracking-widest">Riwayat Aktivitas</h4>
              {loadingRiwayat ? (
                <p className="text-white/40 text-sm">Memuat...</p>
              ) : timeline.length === 0 ? (
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-6 text-center">
                  <p className="text-white/40 text-sm">Belum ada riwayat</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {timeline.map((item: any, idx: number) => (
                    <div key={idx} className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 flex items-center gap-3">
                      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                        item.type === 'spending' ? 'bg-green-500/15' : 'bg-blue-500/15'
                      }`}>
                        <svg className={`w-3.5 h-3.5 ${item.type === 'spending' ? 'text-green-400' : 'text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.type === 'spending' ? 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' : 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'} />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs truncate">{item.description}</p>
                        <p className="text-white/30 text-[10px] mt-0.5">
                          {new Date(item.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      {item.type === 'spending' && item.amount != null && (
                        <span className="text-green-400 font-semibold text-xs whitespace-nowrap">
                          Rp {item.amount.toLocaleString('id-ID')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function getLevelColor(level: string): string {
  switch (level) {
    case 'Platinum': return 'bg-purple-500/15 text-purple-300 border-purple-400/35';
    case 'Gold': return 'bg-yellow-500/15 text-yellow-300 border-yellow-400/35';
    case 'Silver': return 'bg-gray-400/15 text-gray-300 border-gray-400/35';
    default: return 'bg-amber-700/15 text-amber-400/80 border-amber-600/35';
  }
}
