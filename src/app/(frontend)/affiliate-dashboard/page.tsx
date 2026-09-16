'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useMemberAuth } from '@/components/member-auth/MemberAuthProvider';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import MobileLayout from '@/components/MobileLayout';
import { QRCodeCanvas } from 'qrcode.react';
import LoadingScreen from '@/components/LoadingScreen';

interface Reservation {
  id: string;
  patientName: string;
  patientPhone?: string;
  status: string;
  reservationDate: string;
  reservationTime: string;
  finalPrice: number;
  commissionAmount: number;
  treatment: {
    name: string;
  };
}

interface BankAccount {
  id: string;
  accountType: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
}

interface Withdrawal {
  id: string;
  amount: number;
  status: string;
  requestDate: string;
  processedDate?: string;
  adminNotes?: string;
  bankAccount: BankAccount;
}

interface UserData {
  id: string;
  affiliateCode: string;
  isTeamLeader: boolean;
  points: number;
  loyaltyPoints: number;
  loyaltyLevel: string;
  totalReferrals: number;
  totalEarnings: number;
  reservations: Reservation[];
  referrals: Reservation[];
  transactions: Reservation[];
  bankAccounts?: BankAccount[];
  withdrawals?: Withdrawal[];
}

export default function AffiliateDashboardPage() {
  const { user, isLoaded } = useMemberAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [accountType, setAccountType] = useState<'bank' | 'ewallet'>('bank');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [withdrawalMessage, setWithdrawalMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const qrRef = useRef<HTMLCanvasElement>(null);

  const banks = ['Mandiri', 'BRI', 'BCA', 'BSI', 'CIMB Niaga', 'BPD DIY'];
  const ewallets = ['DANA', 'GoPay', 'ShopeePay', 'OVO'];

  const syncAndFetchUser = useCallback(async () => {
    try {
      setLoading(true);
      const fetchResponse = await fetch('/api/user');
      if (!fetchResponse.ok) {
        setUserData(null);
        return;
      }
      const fetchData = await fetchResponse.json();
      if (fetchData.needsSync) {
        const syncResponse = await fetch('/api/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user?.email,
            firstName: user?.firstName,
            lastName: user?.lastName,
          })
        });
        if (!syncResponse.ok) {
          setUserData(null);
          return;
        }
        const response = await fetch('/api/user');
        if (!response.ok) {
          setUserData(null);
          return;
        }
        const data = await response.json();
        setUserData(data.user);
      } else {
        setUserData(fetchData.user);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isLoaded && user) {
      syncAndFetchUser();
    } else if (isLoaded) {
      setLoading(false);
    }
  }, [isLoaded, user, syncAndFetchUser]);

  const copyAffiliateLink = () => {
    const link = `${window.location.origin}/reservation?ref=${userData?.affiliateCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQR = () => {
    const canvas = qrRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `QR-${userData?.affiliateCode}.png`;
    link.href = url;
    link.click();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setWithdrawalMessage(null);

    try {
      const amount = parseFloat(withdrawAmount);
      if (isNaN(amount) || amount <= 0) {
        setWithdrawalMessage({ type: 'error', text: 'Jumlah penarikan tidak valid' });
        setSubmitting(false);
        return;
      }
      if (amount > (userData?.totalEarnings || 0)) {
        setWithdrawalMessage({ type: 'error', text: 'Saldo komisi tidak mencukupi' });
        setSubmitting(false);
        return;
      }
      if (!bankName || !accountNumber || !accountName) {
        setWithdrawalMessage({ type: 'error', text: 'Semua field harus diisi' });
        setSubmitting(false);
        return;
      }

      const response = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, accountType, bankName, accountNumber, accountName })
      });
      const data = await response.json();
      if (!response.ok) {
        setWithdrawalMessage({ type: 'error', text: data.error || 'Gagal mengajukan penarikan' });
        setSubmitting(false);
        return;
      }
      setWithdrawalMessage({ type: 'success', text: 'Penarikan berhasil diajukan! Admin akan memproses dalam 1-3 hari kerja.' });
      setWithdrawAmount('');
      setBankName('');
      setAccountNumber('');
      setAccountName('');
      await syncAndFetchUser();
      setTimeout(() => {
        setShowWithdrawModal(false);
        setWithdrawalMessage(null);
      }, 2000);
    } catch (error) {
      console.error('Withdrawal error:', error);
      setWithdrawalMessage({ type: 'error', text: 'Terjadi kesalahan. Silakan coba lagi.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <MobileLayout>
        <LoadingScreen label="Loading dashboard afiliator..." />
      </MobileLayout>
    );
  }

  if (!user) {
    return (
      <MobileLayout>
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-white/60 mb-4">Silakan login untuk mengakses dashboard ini.</p>
            <Link href="/sign-in" className="bg-primary text-dark px-6 py-3 rounded-lg font-semibold text-sm">
              Sign In
            </Link>
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (!userData) {
    return (
      <MobileLayout>
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-center">
            <p className="text-white/60">Gagal memuat data. Silakan refresh halaman.</p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (!userData.isTeamLeader) {
    return (
      <MobileLayout>
        <Navbar />
        <div className="min-h-screen bg-black flex items-center justify-center p-4 pt-24">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 bg-primary/10 border border-primary/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-white font-bold text-lg mb-2">Akses Terbatas</h2>
            <p className="text-white/60 text-sm mb-6">
              Dashboard Afiliator hanya dapat diakses oleh afiliator terdaftar. Hubungi admin untuk mendaftar sebagai afiliator.
            </p>
            <Link href="/my-prime" className="inline-block bg-primary text-dark px-6 py-3 rounded-lg font-semibold text-sm">
              Kembali ke My Prime
            </Link>
          </div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <Navbar />
      <div className="min-h-screen bg-black">
        <div className="pt-20">
          <div className="max-w-7xl mx-auto px-4 py-6">

            {/* Header */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-1">
                <h1 className="text-white font-bold text-xl">Dashboard Afiliator</h1>
                <Link href="/my-prime" className="text-primary/70 text-xs hover:text-primary transition-colors">
                  My Prime →
                </Link>
              </div>
              <p className="text-white/50 text-xs">
                Selamat datang, {user.firstName || 'Afiliator'}
              </p>
            </div>

            {/* Affiliate Code Card */}
            <div className="mb-4">
              <div className="bg-gradient-to-br from-primary/30 to-primary/10 border border-primary rounded-xl p-4 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="mb-3">
                    <p className="text-white/60 text-xs mb-2">Kode Afiliasi</p>
                    <div className="font-mono text-3xl font-bold text-primary tracking-wider mb-3">
                      {userData.affiliateCode}
                    </div>
                    <p className="text-white/50 text-[10px] mb-2">
                      💡 Hubungi admin untuk mengubah kode afiliasi
                    </p>
                    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-3">
                      <p className="text-white/60 text-xs mb-1.5">Link Referral:</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={`${typeof window !== 'undefined' ? window.location.origin : ''}/reservation?ref=${userData.affiliateCode}`}
                          readOnly
                          className="flex-1 bg-white/5 text-white px-2 py-1.5 rounded text-xs font-mono border border-white/10 focus:outline-none"
                        />
                        <button
                          onClick={copyAffiliateLink}
                          className="bg-primary hover:bg-primary/90 text-dark px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap transition-colors"
                        >
                          {copied ? '✓' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowQRModal(true)}
                      className="w-full mt-3 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors text-xs"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                      Lihat QR Code Referral
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <p className="text-white/70 text-xs">Total Komisi</p>
                </div>
                <p className="font-bold text-lg text-primary">{formatCurrency(userData.totalEarnings)}</p>
              </div>

              <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-white/70 text-xs">Total Reservasi</p>
                </div>
                <p className="font-bold text-lg text-primary">{userData.referrals.length}</p>
                <p className="text-white/50 text-[10px] mt-0.5">
                  Selesai: {userData.referrals.filter((r: Reservation) => r.status === 'completed').length}
                </p>
              </div>

              <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-white/70 text-xs">Pending</p>
                </div>
                <p className="font-bold text-lg text-primary">
                  {userData.referrals.filter((r: Reservation) => r.status === 'pending').length}
                </p>
                <p className="text-white/50 text-[10px] mt-0.5">Menunggu konfirmasi</p>
              </div>

              <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <p className="text-white/70 text-xs">Customer</p>
                </div>
                <p className="font-bold text-lg text-primary">
                  {userData.referrals.filter((r: Reservation) => r.status === 'completed').length}
                </p>
                <p className="text-white/50 text-[10px] mt-0.5">Total dilayani</p>
              </div>
            </div>

            {/* Withdrawal Button */}
            <div className="mb-4">
              <button
                onClick={() => setShowWithdrawModal(true)}
                className="w-full bg-primary hover:bg-primary/90 text-dark font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Tarik Komisi
              </button>
            </div>

            {/* Referral History */}
            <div className="mb-4">
              <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-lg p-4">
                <h3 className="font-bold text-base text-white mb-3">Riwayat Referral</h3>
                {userData.referrals.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-white/60 text-sm">Belum ada referral</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {userData.referrals.slice(0, 10).map((r: Reservation) => (
                      <div key={r.id} className="bg-black/30 border border-white/10 rounded-lg p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-white text-sm truncate">{r.patientName}</p>
                            <p className="text-white/60 text-xs">{r.treatment?.name}</p>
                            <p className="text-white/40 text-[10px] mt-0.5">
                              {new Date(r.reservationDate).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                          <div className="text-right ml-2 flex-shrink-0">
                            <p className="text-primary text-xs font-bold">
                              +{formatCurrency(r.commissionAmount || 0)}
                            </p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                              r.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                              r.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {r.status === 'completed' ? 'Selesai' : r.status === 'pending' ? 'Pending' : r.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Withdrawal History */}
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-lg p-4">
                <h3 className="font-bold text-base text-white mb-3">Riwayat Penarikan</h3>
                {!userData.withdrawals || userData.withdrawals.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-white/60 text-sm">Belum ada riwayat penarikan</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {userData.withdrawals.map((withdrawal: Withdrawal) => (
                      <div key={withdrawal.id} className="bg-black/30 border border-white/10 rounded-lg p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-semibold text-white text-sm">{formatCurrency(withdrawal.amount)}</p>
                            <p className="text-white/70 text-xs">
                              {withdrawal.bankAccount.bankName} - {withdrawal.bankAccount.accountNumber}
                            </p>
                            <p className="text-white/50 text-[10px] mt-0.5">
                              {new Date(withdrawal.requestDate).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                            withdrawal.status === 'completed' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                            withdrawal.status === 'approved' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                            withdrawal.status === 'rejected' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                            'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                          }`}>
                            {withdrawal.status === 'completed' ? 'Selesai' :
                             withdrawal.status === 'approved' ? 'Disetujui' :
                             withdrawal.status === 'rejected' ? 'Ditolak' : 'Pending'}
                          </span>
                        </div>
                        {withdrawal.adminNotes && (
                          <div className="pt-2 border-t border-white/10">
                            <p className="text-white/60 text-xs">
                              <span className="font-semibold">Catatan Admin:</span> {withdrawal.adminNotes}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Withdrawal Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-black to-black/95 border border-primary/30 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-br from-primary/20 to-primary/5 border-b border-primary/30 p-4 flex items-center justify-between">
              <h3 className="font-bold text-lg text-white">Ajukan Penarikan Komisi</h3>
              <button onClick={() => { setShowWithdrawModal(false); setWithdrawalMessage(null); }} className="text-white/60 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              {withdrawalMessage && (
                <div className={`mb-4 p-3 rounded-lg ${
                  withdrawalMessage.type === 'success'
                    ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                    : 'bg-red-500/20 border border-red-500/30 text-red-400'
                }`}>
                  <p className="text-sm">{withdrawalMessage.text}</p>
                </div>
              )}
              <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
                <div>
                  <label className="block text-white/70 text-sm mb-2">Jumlah Penarikan</label>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="Masukkan jumlah"
                    className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                    required
                  />
                  <p className="text-white/50 text-xs mt-1">Saldo tersedia: {formatCurrency(userData.totalEarnings)}</p>
                </div>
                <div>
                  <label className="block text-white/70 text-sm mb-2">Metode Penarikan</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['bank', 'ewallet'] as const).map((t) => (
                      <button key={t} type="button" onClick={() => { setAccountType(t); setBankName(''); }}
                        className={`py-2 px-4 rounded-lg text-sm font-semibold transition-colors ${accountType === t ? 'bg-primary text-dark' : 'bg-black/30 text-white/60 border border-white/20'}`}>
                        {t === 'bank' ? 'Bank' : 'E-Wallet'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-white/70 text-sm mb-2">{accountType === 'bank' ? 'Pilih Bank' : 'Pilih E-Wallet'}</label>
                  <select value={bankName} onChange={(e) => setBankName(e.target.value)}
                    className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary" required>
                    <option value="">-- Pilih {accountType === 'bank' ? 'Bank' : 'E-Wallet'} --</option>
                    {(accountType === 'bank' ? banks : ewallets).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-white/70 text-sm mb-2">{accountType === 'bank' ? 'Nomor Rekening' : 'Nomor E-Wallet'}</label>
                  <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder={accountType === 'bank' ? 'Contoh: 1234567890' : 'Contoh: 08123456789'}
                    className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary" required />
                </div>
                <div>
                  <label className="block text-white/70 text-sm mb-2">Nama Pemilik Rekening</label>
                  <input type="text" value={accountName} onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Nama sesuai rekening"
                    className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary" required />
                </div>
                <button type="submit" disabled={submitting}
                  className="w-full bg-primary hover:bg-primary/90 text-dark font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? 'Memproses...' : 'Ajukan Penarikan'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-black to-black/95 border border-primary/30 rounded-xl max-w-sm w-full">
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 border-b border-primary/30 p-4 flex items-center justify-between">
              <h3 className="font-bold text-lg text-white">QR Code Referral</h3>
              <button onClick={() => setShowQRModal(false)} className="text-white/60 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 text-center">
              <div className="bg-white p-4 rounded-lg inline-block mb-4">
                <QRCodeCanvas
                  ref={qrRef}
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/reservation?ref=${userData?.affiliateCode}`}
                  size={256}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="text-white/80 text-sm mb-2">
                Kode: <span className="font-mono font-bold text-primary">{userData?.affiliateCode}</span>
              </p>
              <p className="text-white/60 text-xs mb-4">Customer scan QR code ini untuk reservasi dengan kode referral Anda</p>
              <button onClick={downloadQR} className="w-full bg-primary hover:bg-primary/90 text-dark font-semibold py-3 px-4 rounded-lg transition-colors">
                Download QR Code
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileLayout>
  );
}
