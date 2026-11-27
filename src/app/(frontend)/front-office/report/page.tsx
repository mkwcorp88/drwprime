'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ExcelJS from 'exceljs';
import { Check, Copy, Download, Eye, MessageCircle, Phone, RefreshCw, Search } from 'lucide-react';
import { Hourglass } from '@/components/LoadingScreen';
import type { PhoneMatchCandidate, PhoneMatchConfidence } from '@/lib/affiliator-phone-matcher';

interface AffiliatorData {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  affiliateCode: string | null;
  totalCommission: number;
  totalWithdrawn: number;
  remainingCommission: number;
  totalReservations: number;
  claimedAt: string;
  phone: string | null;
  displayPhone: string | null;
  phoneConfidence: PhoneMatchConfidence;
  phoneSource: string;
  phoneSourceLabel: string;
  phoneReason: string;
  matchedMemberName: string | null;
  matchedMrNumber: string | null;
  bankAccountNames: string[];
  phoneCandidates: PhoneMatchCandidate[];
}

interface AffiliatorSummary {
  total: number;
  withPhoneCount: number;
  verifiedCount: number;
  exactCount: number;
  highCount: number;
  candidateCount: number;
  missingCount: number;
}

type PhoneFilter = 'all' | 'has_phone' | 'strong' | 'candidate' | 'missing';

const CONFIDENCE_META: Record<
  PhoneMatchConfidence,
  { label: string; badgeClass: string }
> = {
  verified: {
    label: 'Terverifikasi',
    badgeClass: 'border-emerald-400/35 bg-emerald-500/15 text-emerald-300',
  },
  exact: {
    label: 'Exact',
    badgeClass: 'border-sky-400/35 bg-sky-500/15 text-sky-300',
  },
  high: {
    label: 'Cocok Kuat',
    badgeClass: 'border-amber-400/35 bg-amber-500/15 text-amber-200',
  },
  candidate: {
    label: 'Kandidat',
    badgeClass: 'border-orange-400/35 bg-orange-500/15 text-orange-200',
  },
  none: {
    label: 'Belum Ada',
    badgeClass: 'border-white/15 bg-white/5 text-white/45',
  },
};

function normalizeSearchDigits(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('08')) return `62${digits.slice(1)}`;
  return digits;
}

export default function ReportPage() {
  const [affiliators, setAffiliators] = useState<AffiliatorData[]>([]);
  const [summary, setSummary] = useState<AffiliatorSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [phoneFilter, setPhoneFilter] = useState<PhoneFilter>('all');
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [selectedAffiliator, setSelectedAffiliator] = useState<AffiliatorData | null>(null);

  const fetchAffiliators = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/front-office/affiliators', { cache: 'no-store' });
      if (!response.ok) throw new Error('Gagal memuat data report affiliator');
      const data = await response.json();
      setAffiliators(data.affiliators || []);
      setSummary(data.summary || null);
    } catch (err) {
      console.error('Error fetching affiliators:', err);
      setError(err instanceof Error ? err.message : 'Gagal memuat data report affiliator');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAffiliators();
  }, [fetchAffiliators]);

  const computedSummary = useMemo<AffiliatorSummary>(() => {
    if (summary) return summary;
    const stats: AffiliatorSummary = {
      total: affiliators.length,
      withPhoneCount: 0,
      verifiedCount: 0,
      exactCount: 0,
      highCount: 0,
      candidateCount: 0,
      missingCount: 0,
    };
    for (const aff of affiliators) {
      if (aff.phone) stats.withPhoneCount += 1;
      if (aff.phoneConfidence === 'verified') stats.verifiedCount += 1;
      else if (aff.phoneConfidence === 'exact') stats.exactCount += 1;
      else if (aff.phoneConfidence === 'high') stats.highCount += 1;
      else if (aff.phoneConfidence === 'candidate') stats.candidateCount += 1;
      else stats.missingCount += 1;
    }
    return stats;
  }, [affiliators, summary]);

  const filteredAffiliators = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const queryDigits = normalizeSearchDigits(searchQuery);

    return affiliators.filter((aff) => {
      if (phoneFilter === 'has_phone' && !aff.phone) return false;
      if (phoneFilter === 'strong' && !['verified', 'exact', 'high'].includes(aff.phoneConfidence)) return false;
      if (phoneFilter === 'candidate' && aff.phoneConfidence !== 'candidate') return false;
      if (phoneFilter === 'missing' && aff.phoneConfidence !== 'none') return false;

      if (!query) return true;

      const fullName = `${aff.firstName} ${aff.lastName}`.trim().toLowerCase();
      const email = (aff.email || '').toLowerCase();
      const code = (aff.affiliateCode || '').toLowerCase();
      const bankNames = (aff.bankAccountNames || []).join(' ').toLowerCase();
      const matchedName = (aff.matchedMemberName || '').toLowerCase();
      const textMatch =
        fullName.includes(query) ||
        email.includes(query) ||
        code.includes(query) ||
        bankNames.includes(query) ||
        matchedName.includes(query);

      if (textMatch) return true;

      if (queryDigits && queryDigits.length >= 3) {
        const candidatePhones = [
          aff.phone,
          ...(aff.phoneCandidates || []).map((c) => c.phone),
        ].filter((p): p is string => Boolean(p));
        if (candidatePhones.some((p) => p.includes(queryDigits))) return true;
      }

      return false;
    });
  }, [affiliators, phoneFilter, searchQuery]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleCopyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedPhone(phone);
      window.setTimeout(() => {
        setCopiedPhone((current) => (current === phone ? null : current));
      }, 1800);
    } catch (err) {
      console.error('Failed to copy phone:', err);
    }
  };

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report Affiliator');

    worksheet.columns = [
      { header: 'Nama', key: 'nama', width: 25 },
      { header: 'Gmail', key: 'gmail', width: 35 },
      { header: 'No. HP', key: 'noHp', width: 18 },
      { header: 'Status No. HP', key: 'statusNoHp', width: 16 },
      { header: 'Sumber Kecocokan', key: 'sumberNoHp', width: 32 },
      { header: 'Kode', key: 'kode', width: 15 },
      { header: 'Total Komisi', key: 'totalKomisi', width: 18 },
      { header: 'Sudah Ditarik', key: 'sudahDitarik', width: 18 },
      { header: 'Sisa Komisi', key: 'sisaKomisi', width: 18 },
      { header: 'Reservasi', key: 'reservasi', width: 14 },
      { header: 'Terdaftar Kapan', key: 'terdaftar', width: 18 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD4AF37' },
    };

    filteredAffiliators.forEach((aff) => {
      const fullName = `${aff.firstName} ${aff.lastName}`.trim();
      const sourceText = aff.phone
        ? `${aff.phoneSourceLabel}${aff.matchedMemberName && aff.matchedMemberName !== fullName ? ` (${aff.matchedMemberName})` : ''}`
        : 'Belum ditemukan';

      worksheet.addRow({
        nama: fullName,
        gmail: aff.email || '-',
        noHp: aff.phone || '',
        statusNoHp: CONFIDENCE_META[aff.phoneConfidence]?.label || 'Belum Ada',
        sumberNoHp: sourceText,
        kode: aff.affiliateCode || '-',
        totalKomisi: aff.totalCommission,
        sudahDitarik: aff.totalWithdrawn,
        sisaKomisi: aff.remainingCommission,
        reservasi: aff.totalReservations,
        terdaftar: formatDate(aff.claimedAt),
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Report_Affiliator_${new Date().toISOString().split('T')[0]}.xlsx`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen fo-glass-page fo-theme-report">
        <div className="pt-20 flex items-center justify-center">
          <Hourglass size={56} />
        </div>
      </div>
    );
  }

  const strongCount =
    computedSummary.verifiedCount + computedSummary.exactCount + computedSummary.highCount;

  const filterButtons: Array<{ key: PhoneFilter; label: string; count: number }> = [
    { key: 'all', label: 'Semua', count: computedSummary.total },
    { key: 'has_phone', label: 'Ada Nomor', count: computedSummary.withPhoneCount },
    { key: 'strong', label: 'Cocok Kuat', count: strongCount },
    { key: 'candidate', label: 'Kandidat', count: computedSummary.candidateCount },
    { key: 'missing', label: 'Belum Ada', count: computedSummary.missingCount },
  ];

  return (
    <div className="min-h-screen fo-glass-page fo-theme-report">
      <div className="pt-20">
        <div className="max-w-7xl mx-auto px-4 py-6 fo-fade-up">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">📊 Report Affiliator</h1>
              <p className="text-white/60 text-sm">
                Daftar affiliator terdaftar beserta hasil crawl nomor HP/WhatsApp dari profil, transaksi, rekening, CRM, dan data member
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void fetchAffiliators()}
                className="fo-glass-card-soft border-white/20 text-white/80 px-3.5 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Muat Ulang
              </button>
              <button
                type="button"
                onClick={() => void exportToExcel()}
                className="fo-glass-card-soft border-green-500/35 text-green-300 px-4 py-2 rounded-lg hover:bg-green-500/20 transition-colors text-sm font-semibold flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export Excel ({filteredAffiliators.length})
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-500/35 bg-red-500/15 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 fo-fade-up fo-stagger-1">
            <div className="fo-glass-card rounded-xl p-5 border-primary/40">
              <p className="text-white/70 text-xs uppercase tracking-wider mb-1">Total Affiliator</p>
              <p className="text-3xl sm:text-4xl font-bold text-primary">{computedSummary.total}</p>
              <p className="text-white/50 text-xs mt-1">orang terdaftar</p>
            </div>
            <div className="fo-glass-card rounded-xl p-5 border-emerald-500/30">
              <p className="text-white/70 text-xs uppercase tracking-wider mb-1">Nomor Kuat</p>
              <p className="text-3xl sm:text-4xl font-bold text-emerald-300">{strongCount}</p>
              <p className="text-white/50 text-xs mt-1">
                {computedSummary.verifiedCount} profil · {computedSummary.exactCount} email · {computedSummary.highCount} nama persis
              </p>
            </div>
            <div className="fo-glass-card rounded-xl p-5 border-orange-500/30">
              <p className="text-white/70 text-xs uppercase tracking-wider mb-1">Kandidat Nama</p>
              <p className="text-3xl sm:text-4xl font-bold text-orange-300">{computedSummary.candidateCount}</p>
              <p className="text-white/50 text-xs mt-1">perlu cek / konfirmasi FO</p>
            </div>
            <div className="fo-glass-card rounded-xl p-5 border-white/15">
              <p className="text-white/70 text-xs uppercase tracking-wider mb-1">Belum Ada Nomor</p>
              <p className="text-3xl sm:text-4xl font-bold text-white/80">{computedSummary.missingCount}</p>
              <p className="text-white/50 text-xs mt-1">belum cocok di data member</p>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="fo-glass-card rounded-xl p-4 mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, email, kode, atau nomor HP..."
                className="fo-glass-input w-full rounded-lg pl-9 pr-3 py-2 text-sm placeholder:text-white/40"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {filterButtons.map((btn) => {
                const active = phoneFilter === btn.key;
                return (
                  <button
                    key={btn.key}
                    type="button"
                    onClick={() => setPhoneFilter(btn.key)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'border-primary/60 bg-primary/20 text-primary'
                        : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {btn.label} ({btn.count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Affiliators List */}
          <div className="fo-glass-card fo-fade-up fo-stagger-2 rounded-xl overflow-hidden">
            <div className="fo-glass-card-soft border-b border-primary/30 p-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold text-white">Daftar Affiliator & Nomor Kontak</h2>
              <span className="text-xs text-white/55">
                Menampilkan {filteredAffiliators.length} dari {affiliators.length} affiliator
              </span>
            </div>

            {filteredAffiliators.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-white/60">
                  {affiliators.length === 0
                    ? 'Belum ada affiliator yang terdaftar'
                    : 'Tidak ada affiliator yang sesuai dengan filter/pencarian'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px]">
                  <thead className="fo-glass-card-soft border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">No</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Nama</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">No. HP / WhatsApp</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Kode</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Total Komisi</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Sudah Ditarik</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Sisa Komisi</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Reservasi</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/70">Terdaftar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredAffiliators.map((affiliator, index) => {
                      const fullName = `${affiliator.firstName} ${affiliator.lastName}`.trim();
                      const confidenceMeta = CONFIDENCE_META[affiliator.phoneConfidence] || CONFIDENCE_META.none;
                      const showBankHint =
                        affiliator.bankAccountNames.length > 0 &&
                        affiliator.bankAccountNames[0].toLowerCase() !== fullName.toLowerCase();

                      return (
                        <tr
                          key={affiliator.id || `${affiliator.email ?? ''}-${affiliator.affiliateCode ?? index}`}
                          className="hover:bg-white/5 transition-colors align-top"
                        >
                          <td className="px-4 py-3 text-sm text-white/80">{index + 1}</td>
                          <td className="px-4 py-3 text-sm text-white">
                            <p className="font-medium">{fullName || '-'}</p>
                            {showBankHint && (
                              <p className="text-[11px] text-white/45 mt-0.5">
                                Rek: {affiliator.bankAccountNames[0]}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-white/60">{affiliator.email || '-'}</td>
                          <td className="px-4 py-3 text-sm">
                            {affiliator.phone ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <a
                                    href={`https://wa.me/${affiliator.phone}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Buka WhatsApp"
                                    className="inline-flex items-center gap-1 font-mono text-xs sm:text-sm font-semibold text-emerald-300 hover:text-emerald-200"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                                    {affiliator.displayPhone || affiliator.phone}
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => void handleCopyPhone(affiliator.phone!)}
                                    title="Salin nomor"
                                    className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                                  >
                                    {copiedPhone === affiliator.phone ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span
                                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${confidenceMeta.badgeClass}`}
                                  >
                                    {confidenceMeta.label} · {affiliator.phoneSourceLabel}
                                  </span>
                                  {affiliator.phoneCandidates.length > 0 && affiliator.phoneConfidence !== 'verified' && (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedAffiliator(affiliator)}
                                      className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                                    >
                                      <Eye className="w-3 h-3" />
                                      {affiliator.phoneCandidates.length > 1
                                        ? `${affiliator.phoneCandidates.length} kandidat`
                                        : 'Detail'}
                                    </button>
                                  )}
                                </div>
                                {affiliator.matchedMemberName &&
                                  affiliator.phoneConfidence !== 'verified' &&
                                  affiliator.matchedMemberName.toLowerCase() !== fullName.toLowerCase() && (
                                    <p className="text-[11px] text-white/45">
                                      Cocok: {affiliator.matchedMemberName}
                                      {affiliator.matchedMrNumber ? ` · RM ${affiliator.matchedMrNumber}` : ''}
                                    </p>
                                  )}
                              </div>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${confidenceMeta.badgeClass}`}
                              >
                                <Phone className="w-3 h-3" />
                                Belum ada
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className="font-mono text-primary">{affiliator.affiliateCode || '-'}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-white/80">
                            {formatCurrency(affiliator.totalCommission)}
                          </td>
                          <td className="px-4 py-3 text-sm text-red-400">
                            {formatCurrency(affiliator.totalWithdrawn)}
                          </td>
                          <td className="px-4 py-3 text-sm text-green-400 font-semibold">
                            {formatCurrency(affiliator.remainingCommission)}
                          </td>
                          <td className="px-4 py-3 text-sm text-white/80">
                            {affiliator.totalReservations} reservasi
                          </td>
                          <td className="px-4 py-3 text-sm text-white/60">
                            {formatDate(affiliator.claimedAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Candidate / Match Detail Modal */}
      {selectedAffiliator && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setSelectedAffiliator(null)}
        >
          <div
            className="fo-glass-modal w-full max-w-2xl rounded-2xl p-6 text-white max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">
                  Detail Pencocokan Nomor · {`${selectedAffiliator.firstName} ${selectedAffiliator.lastName}`.trim()}
                </h3>
                <p className="text-xs text-white/60 mt-1">
                  {selectedAffiliator.email || 'Tanpa email'} · Kode{' '}
                  <span className="font-mono text-primary">{selectedAffiliator.affiliateCode}</span>
                </p>
                {selectedAffiliator.bankAccountNames.length > 0 && (
                  <p className="text-xs text-white/55 mt-1">
                    Nama Rekening: {selectedAffiliator.bankAccountNames.join(', ')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedAffiliator(null)}
                className="rounded-lg border border-white/15 px-3 py-1 text-xs text-white/70 hover:bg-white/10"
              >
                Tutup
              </button>
            </div>

            <div className="space-y-3">
              {selectedAffiliator.phoneCandidates.map((candidate, idx) => {
                const meta = CONFIDENCE_META[candidate.confidence];
                return (
                  <div
                    key={`${candidate.phone}-${idx}`}
                    className="rounded-xl border border-white/15 bg-black/30 p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-base font-bold text-emerald-300">
                          {candidate.displayPhone}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.badgeClass}`}
                        >
                          {meta.label} · {candidate.sourceLabel}
                        </span>
                        <span className="text-[11px] text-white/45">Skor {candidate.score}</span>
                      </div>
                      <p className="text-xs text-white/80">
                        Nama terdata: <span className="font-semibold">{candidate.matchedName}</span>
                        {candidate.matchedMrNumber ? ` · RM ${candidate.matchedMrNumber}` : ''}
                      </p>
                      <p className="text-xs text-white/55">{candidate.reason}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleCopyPhone(candidate.phone)}
                        className="rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/10 flex items-center gap-1"
                      >
                        {copiedPhone === candidate.phone ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" /> Tersalin
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> Salin
                          </>
                        )}
                      </button>
                      <a
                        href={`https://wa.me/${candidate.phone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 flex items-center gap-1"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
