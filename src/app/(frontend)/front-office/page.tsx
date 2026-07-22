'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import InstallPrompt from '@/components/InstallPrompt';
import LoadingScreen, { Hourglass } from '@/components/LoadingScreen';

interface Reservation {
  id: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  patientNotes?: string;
  reservationDate: string;
  reservationTime: string;
  status: string;
  originalPrice: number;
  finalPrice: number;
  commissionAmount: number;
  adminNotes?: string;
  referredBy?: string | null;
  treatment: {
    name: string;
    category: {
      name: string;
    };
  };
  user: {
    firstName: string;
    lastName: string;
    email: string;
    affiliateCode: string;
  };
  referrer?: {
    firstName: string;
    lastName: string;
    affiliateCode: string;
  };
  createdAt: string;
}

interface Treatment {
  id: string;
  name: string;
  categoryName: string;
}

interface EditFormData {
  reservationId: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  reservationDate: string;
  reservationTime: string;
  treatmentId: string;
  finalPrice: number;
  status: string;
  adminNotes: string;
  patientNotes: string;
  affiliateCode: string;
}

const getAffiliateFullName = (referrer?: Reservation['referrer']) => {
  if (!referrer) return '';
  return `${referrer.firstName} ${referrer.lastName}`.trim();
};

export default function FrontOfficePage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [expandedReservation, setExpandedReservation] = useState<string | null>(null);
  const [showAffiliateModal, setShowAffiliateModal] = useState(false);
  const [affiliateCode, setAffiliateCode] = useState('');
  const [affiliateError, setAffiliateError] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState<EditFormData | null>(null);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [reservationToDelete, setReservationToDelete] = useState<Reservation | null>(null);
  const [deleteError, setDeleteError] = useState('');


  const fetchReservations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterDate) params.append('date', filterDate);

      const response = await fetch(`/api/front-office/reservations?${params}`);
      const data = await response.json();
      setReservations(data.reservations || []);
    } catch (error) {
      console.error('Error fetching reservations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTreatments = async () => {
    try {
      const response = await fetch('/api/treatments');
      const data = await response.json();
      const allTreatments = data.categories.flatMap((cat: { name: string; treatments: Treatment[] }) => 
        cat.treatments.map((t: Treatment) => ({ ...t, categoryName: cat.name }))
      );
      setTreatments(allTreatments);
    } catch (error) {
      console.error('Error fetching treatments:', error);
    }
  };

  useEffect(() => {
    fetchReservations();
    fetchTreatments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterDate]);

  const updateReservationStatus = async (id: string, status: string, adminNotes?: string, finalPrice?: number) => {
    try {
      const response = await fetch('/api/front-office/reservations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId: id, status, adminNotes, finalPrice })
      });

      if (response.ok) {
        fetchReservations();
        setSelectedReservation(null);
        setShowPaymentModal(false);
        setPaymentAmount('');
      }
    } catch (error) {
      console.error('Error updating reservation:', error);
    }
  };

  const handleCompleteWithPayment = () => {
    if (!selectedReservation || !paymentAmount) return;
    
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    updateReservationStatus(selectedReservation.id, 'completed', undefined, amount);
  };

  const handleAddAffiliate = async () => {
    if (!selectedReservation || !affiliateCode) {
      setAffiliateError('Masukkan kode affiliate');
      return;
    }

    try {
      const response = await fetch(`/api/front-office/reservations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId: selectedReservation.id,
          affiliateCode: affiliateCode.trim().toUpperCase(),
          action: 'addAffiliate'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setAffiliateError(data.error || 'Gagal menambahkan affiliate');
        return;
      }

      // Success - refresh data
      await fetchReservations();
      setShowAffiliateModal(false);
      setAffiliateCode('');
      setAffiliateError('');
      setSelectedReservation(null);
    } catch (error) {
      console.error('Error adding affiliate:', error);
      setAffiliateError('Terjadi kesalahan. Silakan coba lagi.');
    }
  };

  const handleOpenEditModal = (reservation: Reservation) => {
    setEditFormData({
      reservationId: reservation.id,
      patientName: reservation.patientName,
      patientEmail: reservation.patientEmail,
      patientPhone: reservation.patientPhone,
      reservationDate: new Date(reservation.reservationDate).toISOString().split('T')[0],
      reservationTime: reservation.reservationTime,
      treatmentId: reservation.treatment ? (treatments.find(t => t.name === reservation.treatment.name)?.id || '') : '',
      finalPrice: reservation.finalPrice,
      status: reservation.status,
      adminNotes: reservation.adminNotes || '',
      patientNotes: reservation.patientNotes || '',
      affiliateCode: reservation.referrer?.affiliateCode || ''
    });
    setShowEditModal(true);
    setEditError('');
    setEditSuccess('');
  };

  const handleEditReservation = async () => {
    if (!editFormData) return;

    try {
      setEditError('');
      setEditSuccess('');

      const response = await fetch('/api/front-office/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData)
      });

      const data = await response.json();

      if (!response.ok) {
        setEditError(data.error || 'Gagal mengupdate reservasi');
        return;
      }

      // Success
      setEditSuccess('Reservasi berhasil diupdate!');
      await fetchReservations();
      
      // Close modal after 1 second
      setTimeout(() => {
        setShowEditModal(false);
        setEditFormData(null);
        setEditError('');
        setEditSuccess('');
      }, 1000);
    } catch (error) {
      console.error('Error updating reservation:', error);
      setEditError('Terjadi kesalahan. Silakan coba lagi.');
    }
  };

  const handleDeleteReservation = async () => {
    if (!reservationToDelete) return;

    try {
      setDeleteError('');

      const response = await fetch(`/api/front-office/reservations?id=${reservationToDelete.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        setDeleteError(data.error || 'Gagal menghapus reservasi');
        return;
      }

      // Success - refresh data and close modal
      await fetchReservations();
      setShowDeleteModal(false);
      setReservationToDelete(null);
      setDeleteError('');
    } catch (error) {
      console.error('Error deleting reservation:', error);
      setDeleteError('Terjadi kesalahan. Silakan coba lagi.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/16 text-yellow-300 border-yellow-400/35';
      case 'confirmed': return 'bg-blue-500/16 text-blue-300 border-blue-400/35';
      case 'completed': return 'bg-green-500/16 text-green-300 border-green-400/35';
      case 'cancelled': return 'bg-red-500/16 text-red-300 border-red-400/35';
      default: return 'bg-gray-500/16 text-gray-300 border-gray-400/35';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen fo-glass-page fo-theme-dashboard">
      <div className="max-w-7xl mx-auto px-5 py-10">
        {/* Header */}
        <div className="mb-10 fo-fade-up">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex-1">
              <h1 className="font-playfair text-3xl sm:text-4xl md:text-5xl font-bold text-primary mb-2 leading-tight">
                Front Office Dashboard
              </h1>
               <p className="text-white/70 text-base sm:text-lg">
                 Manage reservations and appointments
               </p>
               <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-wrap gap-2.5 mt-4">
                 <Link
                   href="/front-office/performance"
                   className="fo-nav-chip text-sm text-center"
                 >
                   Performance
                 </Link>
                 <Link 
                   href="/front-office/codes"
                   className="fo-nav-chip text-sm text-center"
                >
                  Manage Affiliate Codes
                </Link>
                <Link 
                  href="/front-office/report"
                  className="fo-nav-chip text-sm text-center"
                >
                  Report Affiliator
                </Link>
                <Link 
                  href="/front-office/completed-profiles"
                  className="fo-nav-chip text-sm text-center"
                >
                  Membership Profil
                </Link>
                <Link 
                  href="/front-office/spending-scan"
                  className="fo-nav-chip text-sm text-center"
                >
                  Catat Spending (Scan)
                </Link>
                <Link 
                  href="/front-office/report-spending-daily"
                  className="fo-nav-chip text-sm text-center"
                >
                  Report Spending Daily
                </Link>
                <Link 
                  href="/front-office/best-deals"
                  className="fo-nav-chip text-sm text-center"
                >
                  Best Deal Manager
                </Link>
                <Link 
                  href="/front-office/bulk-import"
                  className="fo-nav-chip text-sm text-center"
                >
                  Bulk Import Members
                </Link>
                <Link 
                  href="/front-office/blog"
                  className="fo-nav-chip text-sm text-center col-span-2 sm:col-span-1"
                >
                  Blog Manager
                </Link>
              </div>
            </div>
            <Image 
              src="/drwprime-logo.png" 
              alt="DRW Prime" 
              width={120}
              height={40}
              className="h-9 w-auto sm:h-10 shrink-0"
            />
          </div>
        </div>

        {/* Install App (mobile, untuk FO) */}
        <InstallPrompt />

        {/* Status Tracker — model pengiriman marketplace */}
        <div className="fo-fade-up fo-stagger-1 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl p-4 sm:p-6 mb-6">
          <div className="flex items-stretch gap-0">
            {/* Pending */}
            <div className="flex flex-col items-center flex-1 relative">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-yellow-500/10 border border-yellow-400/25 flex items-center justify-center mb-1.5 backdrop-blur-sm shadow-[0_0_24px_rgba(234,179,8,0.1),inset_0_1px_0_rgba(255,255,255,0.05)]">
                <svg className="w-6 h-6 sm:w-7 sm:h-7 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-yellow-400 font-bold text-xl sm:text-2xl">{reservations.filter(r => r.status === 'pending').length}</span>
              <div className="absolute top-7 sm:top-8 left-[calc(50%+2rem)] right-0 h-px bg-gradient-to-r from-yellow-400/25 via-white/5 to-transparent mt-0.5" />
              <span className="text-yellow-400/80 text-[10px] sm:text-xs font-semibold tracking-wider uppercase mt-0.5">Pending</span>
            </div>

            {/* Confirmed */}
            <div className="flex flex-col items-center flex-1 relative">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-blue-500/10 border border-blue-400/25 flex items-center justify-center mb-1.5 backdrop-blur-sm shadow-[0_0_24px_rgba(59,130,246,0.1),inset_0_1px_0_rgba(255,255,255,0.05)]">
                <svg className="w-6 h-6 sm:w-7 sm:h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-blue-400 font-bold text-xl sm:text-2xl">{reservations.filter(r => r.status === 'confirmed').length}</span>
              <div className="absolute top-7 sm:top-8 left-[calc(50%+2rem)] right-0 h-px bg-gradient-to-r from-blue-400/25 via-white/5 to-transparent mt-0.5" />
              <span className="text-blue-400/80 text-[10px] sm:text-xs font-semibold tracking-wider uppercase mt-0.5">Confirmed</span>
            </div>

            {/* Completed */}
            <div className="flex flex-col items-center flex-1 relative">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-green-500/10 border border-green-400/25 flex items-center justify-center mb-1.5 backdrop-blur-sm shadow-[0_0_24px_rgba(34,197,94,0.1),inset_0_1px_0_rgba(255,255,255,0.05)]">
                <svg className="w-6 h-6 sm:w-7 sm:h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-green-400 font-bold text-xl sm:text-2xl">{reservations.filter(r => r.status === 'completed').length}</span>
              <span className="text-green-400/80 text-[10px] sm:text-xs font-semibold tracking-wider uppercase mt-0.5">Selesai</span>
            </div>
          </div>
        </div>

        {/* Total Today */}
        <div className="fo-fade-up fo-stagger-2 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(212,175,55,0.06),rgba(212,175,55,0.02))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl p-5 sm:p-6 mb-10 text-center">
          <p className="text-white/50 text-sm mb-1 tracking-wide flex items-center justify-center gap-1.5">
            <svg className="w-4 h-4 text-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Total Reservasi Hari Ini
          </p>
          <p className="font-playfair text-4xl sm:text-5xl font-bold text-primary">
            {reservations.length}
          </p>
        </div>

        {/* Reservations List */}
        <div className="fo-glass-card fo-fade-up fo-stagger-2 rounded-xl p-6 border-primary/35">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-playfair text-2xl font-bold text-white">Reservations</h2>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6 pb-6 border-b border-white/10">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="fo-glass-input px-4 py-2 rounded-lg [&>option]:text-black"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="fo-glass-input px-4 py-2 rounded-lg [color-scheme:dark]"
            />

            {filterDate && (
              <button
                onClick={() => setFilterDate('')}
                className="bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg hover:bg-red-500/30 transition-colors"
              >
                Clear Date
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-10">
              <Hourglass size={52} />
              <p className="text-white/60 mt-4">Loading...</p>
            </div>
          ) : reservations.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-white/60">No reservations found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="fo-ios-card overflow-hidden"
                >
                  {/* Collapsed Header */}
                  <div
                    className="flex items-start justify-between p-4 md:p-5 cursor-pointer hover:bg-white/5 transition-all"
                    onClick={() => setExpandedReservation(expandedReservation === reservation.id ? null : reservation.id)}
                  >
                    <div className="flex items-start gap-3 md:gap-4 flex-1">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <h3 className="font-semibold text-white text-base md:text-lg leading-tight">
                            {reservation.patientName}
                          </h3>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] tracking-wide font-semibold border backdrop-blur-sm ${getStatusColor(reservation.status)}`}>
                            {reservation.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-white/70 text-sm leading-snug">
                          {reservation.treatment.name}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-white text-xs md:text-sm font-semibold">{formatDate(reservation.reservationDate)}</p>
                        <p className="text-primary text-xs md:text-sm font-medium mt-0.5">{reservation.reservationTime}</p>
                      </div>
                    </div>
                    <svg 
                      className={`w-5 h-5 text-white/60 ml-4 transition-transform ${expandedReservation === reservation.id ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {/* Expanded Content */}
                  {expandedReservation === reservation.id && (
                    <div className="px-4 pb-4 md:px-5 md:pb-5 space-y-3 border-t border-white/10">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm pt-3">
                        <div>
                          <p className="text-white/40 text-xs mb-1">Phone</p>
                          <p className="text-white">{reservation.patientPhone}</p>
                        </div>
                        <div>
                          <p className="text-white/40 text-xs mb-1">Email</p>
                          <p className="text-white text-sm">{reservation.patientEmail}</p>
                        </div>
                        <div>
                          <p className="text-white/40 text-xs mb-1">Category</p>
                          <p className="text-white">{reservation.treatment.category.name}</p>
                        </div>
                        <div>
                          <p className="text-white/40 text-xs mb-1">Price</p>
                          <p className="text-primary font-semibold">{formatCurrency(reservation.finalPrice)}</p>
                        </div>
                      </div>

                      {reservation.patientNotes && (
                        <div>
                          <p className="text-white/40 text-xs mb-1">Notes</p>
                          <p className="text-white text-sm">{reservation.patientNotes}</p>
                        </div>
                      )}

                      {(reservation.referrer || reservation.referredBy) && (
                        <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
                          <p className="text-primary text-xs font-semibold mb-1">Affiliate</p>
                          {reservation.referrer && (
                            <p className="text-white/70 text-xs mb-1">Nama Afiliator: {getAffiliateFullName(reservation.referrer)}</p>
                          )}
                          <p className="text-white text-sm font-semibold">Kode: {' '}
                            {reservation.referrer?.affiliateCode || reservation.referredBy}
                          </p>
                          {!reservation.referrer && reservation.referredBy && (
                            <p className="text-yellow-400 text-xs mt-1">Unclaimed</p>
                          )}
                          {reservation.commissionAmount > 0 && (
                            <p className="text-green-400 text-sm mt-1">
                              +{formatCurrency(reservation.commissionAmount)}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditModal(reservation);
                          }}
                          className="fo-ios-btn fo-ios-btn-neutral"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setReservationToDelete(reservation);
                            setShowDeleteModal(true);
                          }}
                          className="fo-ios-btn fo-ios-btn-danger"
                        >
                          Delete
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReservation(reservation);
                          }}
                          className="fo-ios-btn fo-ios-btn-warn"
                        >
                          View Details
                        </button>
                        {reservation.status === 'pending' && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateReservationStatus(reservation.id, 'confirmed');
                              }}
                              className="fo-ios-btn fo-ios-btn-info"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateReservationStatus(reservation.id, 'cancelled');
                              }}
                              className="fo-ios-btn fo-ios-btn-danger"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {reservation.status === 'confirmed' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedReservation(reservation);
                              setShowPaymentModal(true);
                            }}
                            className="fo-ios-btn fo-ios-btn-success md:col-span-2"
                          >
                            Complete
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedReservation && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="fo-glass-modal rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-playfair text-2xl font-bold text-white">
                Reservation Details
              </h3>
              <button
                onClick={() => setSelectedReservation(null)}
                className="text-white/60 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <p className="text-white/60 text-sm mb-1">Patient Name</p>
                <p className="text-white font-semibold">{selectedReservation.patientName}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-white/60 text-sm mb-1">Phone</p>
                  <p className="text-white">{selectedReservation.patientPhone}</p>
                </div>
                <div>
                  <p className="text-white/60 text-sm mb-1">Email</p>
                  <p className="text-white">{selectedReservation.patientEmail}</p>
                </div>
              </div>
              <div>
                <p className="text-white/60 text-sm mb-1">Treatment</p>
                <p className="text-white font-semibold">
                  {selectedReservation.treatment.category.name} - {selectedReservation.treatment.name}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-white/60 text-sm mb-1">Date</p>
                  <p className="text-white">{formatDate(selectedReservation.reservationDate)}</p>
                </div>
                <div>
                  <p className="text-white/60 text-sm mb-1">Time</p>
                  <p className="text-white">{selectedReservation.reservationTime}</p>
                </div>
              </div>
              <div>
                <p className="text-white/60 text-sm mb-1">Price</p>
                <p className="text-primary font-bold text-xl">
                  {formatCurrency(selectedReservation.finalPrice)}
                </p>
              </div>
              {selectedReservation.patientNotes && (
                <div>
                  <p className="text-white/60 text-sm mb-1">Patient Notes</p>
                  <p className="text-white">{selectedReservation.patientNotes}</p>
                </div>
              )}
              {selectedReservation.referrer || selectedReservation.referredBy ? (
                <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                  <p className="text-primary font-semibold mb-2">Affiliate</p>
                  {selectedReservation.referrer && (
                    <p className="text-white/80 text-sm mb-1">Nama Afiliator: {getAffiliateFullName(selectedReservation.referrer)}</p>
                  )}
                  <p className="text-white text-lg font-bold font-mono">Kode: {' '}
                    {selectedReservation.referrer?.affiliateCode || selectedReservation.referredBy}
                  </p>
                  {!selectedReservation.referrer && selectedReservation.referredBy && (
                    <p className="text-yellow-400 text-sm mt-1">Unclaimed Code</p>
                  )}
                  <p className="text-green-400 text-sm mt-2">
                    Commission: {formatCurrency(selectedReservation.commissionAmount)}
                  </p>
                </div>
              ) : (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-yellow-400 font-semibold mb-1">No Affiliate</p>
                      <p className="text-white/60 text-xs">Reservasi ini belum memiliki referrer</p>
                    </div>
                    <button
                      onClick={() => setShowAffiliateModal(true)}
                      className="bg-primary/20 border border-primary/30 text-primary px-4 py-2 rounded-lg hover:bg-primary/30 transition-colors text-sm font-semibold whitespace-nowrap"
                    >
                      + Add Referrer
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {selectedReservation.status === 'pending' && (
              <div className="flex gap-3">
                <button
                  onClick={() => updateReservationStatus(selectedReservation.id, 'confirmed')}
                  className="flex-1 bg-blue-500/20 border border-blue-500/30 text-blue-400 py-3 rounded-lg hover:bg-blue-500/30 transition-colors font-semibold"
                >
                  Confirm
                </button>
                <button
                  onClick={() => updateReservationStatus(selectedReservation.id, 'cancelled')}
                  className="flex-1 bg-red-500/20 border border-red-500/30 text-red-400 py-3 rounded-lg hover:bg-red-500/30 transition-colors font-semibold"
                >
                  Cancel
                </button>
              </div>
            )}
            {selectedReservation.status === 'confirmed' && (
              <button
                onClick={() => setShowPaymentModal(true)}
                className="w-full bg-green-500/20 border border-green-500/30 text-green-400 py-3 rounded-lg hover:bg-green-500/30 transition-colors font-semibold"
              >
                Complete with Payment
              </button>
            )}
          </div>
        </div>
      )}

      {/* Add Affiliate Modal */}
      {showAffiliateModal && selectedReservation && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="fo-glass-modal rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-playfair text-2xl font-bold text-white">
                Tambah Affiliate
              </h3>
              <button
                onClick={() => {
                  setShowAffiliateModal(false);
                  setAffiliateCode('');
                  setAffiliateError('');
                }}
                className="text-white/60 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <p className="text-white/60 text-sm mb-1">Patient</p>
                <p className="text-white font-semibold">{selectedReservation.patientName}</p>
              </div>
              <div>
                <p className="text-white/60 text-sm mb-1">Treatment</p>
                <p className="text-white">{selectedReservation.treatment.name}</p>
              </div>

              <div>
                <label className="text-white font-semibold mb-2 block">
                  Kode Affiliate *
                </label>
                <input
                  type="text"
                  value={affiliateCode}
                  onChange={(e) => {
                    setAffiliateCode(e.target.value.toUpperCase());
                    setAffiliateError('');
                  }}
                  placeholder="Contoh: JO5X9"
                  className="w-full fo-glass-input border-2 border-primary/30 px-4 py-3 rounded-lg text-lg font-mono uppercase"
                  maxLength={10}
                />
                <p className="text-white/40 text-xs mt-1">
                  Masukkan kode affiliate untuk menambahkan referrer ke reservasi ini
                </p>
                {affiliateError && (
                  <p className="text-red-400 text-sm mt-2">{affiliateError}</p>
                )}
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-yellow-400 text-xs">
                  ⚠️ Pastikan kode affiliate valid. Komisi akan dihitung berdasarkan final price reservasi.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAffiliateModal(false);
                  setAffiliateCode('');
                  setAffiliateError('');
                }}
                className="flex-1 fo-glass-card-soft text-white py-3 rounded-lg hover:bg-white/10 transition-colors font-semibold"
              >
                Batal
              </button>
              <button
                onClick={handleAddAffiliate}
                disabled={!affiliateCode}
                className="flex-1 fo-glass-card-soft border-primary/35 text-primary py-3 rounded-lg hover:bg-primary/20 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editFormData && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="fo-glass-modal rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-playfair text-2xl font-bold text-white">
                Edit Reservasi
              </h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditFormData(null);
                  setEditError('');
                  setEditSuccess('');
                }}
                className="text-white/60 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 mb-6">
              {/* Patient Info */}
              <div className="fo-glass-card-soft rounded-lg p-4 space-y-3">
                <h4 className="text-white font-semibold mb-2">Informasi Pasien</h4>
                <div>
                  <label className="text-white/60 text-sm mb-1 block">Nama Pasien *</label>
                  <input
                    type="text"
                    value={editFormData.patientName}
                    onChange={(e) => setEditFormData({...editFormData, patientName: e.target.value})}
                    className="w-full fo-glass-input px-3 py-2 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/60 text-sm mb-1 block">Email *</label>
                    <input
                      type="email"
                      value={editFormData.patientEmail}
                      onChange={(e) => setEditFormData({...editFormData, patientEmail: e.target.value})}
                      className="w-full fo-glass-input px-3 py-2 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-white/60 text-sm mb-1 block">Phone *</label>
                    <input
                      type="tel"
                      value={editFormData.patientPhone}
                      onChange={(e) => setEditFormData({...editFormData, patientPhone: e.target.value})}
                      className="w-full fo-glass-input px-3 py-2 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Reservation Details */}
              <div className="fo-glass-card-soft rounded-lg p-4 space-y-3">
                <h4 className="text-white font-semibold mb-2">Detail Reservasi</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/60 text-sm mb-1 block">Tanggal *</label>
                    <input
                      type="date"
                      value={editFormData.reservationDate}
                      onChange={(e) => setEditFormData({...editFormData, reservationDate: e.target.value})}
                      className="w-full fo-glass-input px-3 py-2 rounded-lg [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="text-white/60 text-sm mb-1 block">Waktu *</label>
                    <input
                      type="time"
                      value={editFormData.reservationTime}
                      onChange={(e) => setEditFormData({...editFormData, reservationTime: e.target.value})}
                      className="w-full fo-glass-input px-3 py-2 rounded-lg [color-scheme:dark]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-white/60 text-sm mb-1 block">Treatment *</label>
                  <select
                    value={editFormData.treatmentId}
                    onChange={(e) => setEditFormData({...editFormData, treatmentId: e.target.value})}
                    className="w-full fo-glass-input px-3 py-2 rounded-lg [&>option]:text-black"
                  >
                    <option value="">Pilih Treatment</option>
                    {treatments.map((treatment) => (
                      <option key={treatment.id} value={treatment.id}>
                        {treatment.categoryName} - {treatment.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/60 text-sm mb-1 block">Status *</label>
                    <select
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                      className="w-full fo-glass-input px-3 py-2 rounded-lg [&>option]:text-black"
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-white/60 text-sm mb-1 block">Final Price *</label>
                    <input
                      type="number"
                      value={editFormData.finalPrice}
                      onChange={(e) => setEditFormData({...editFormData, finalPrice: parseFloat(e.target.value)})}
                      className="w-full fo-glass-input px-3 py-2 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Affiliate Code */}
              <div className="fo-glass-card-soft rounded-lg p-4">
                <h4 className="text-white font-semibold mb-2">Kode Affiliate</h4>
                <div>
                  <label className="text-white/60 text-sm mb-1 block">Kode Affiliate (opsional)</label>
                  <input
                    type="text"
                    value={editFormData.affiliateCode}
                    onChange={(e) => setEditFormData({...editFormData, affiliateCode: e.target.value.toUpperCase()})}
                    placeholder="Contoh: JO5X9"
                    className="w-full fo-glass-input px-3 py-2 rounded-lg font-mono uppercase"
                    maxLength={10}
                  />
                  <p className="text-white/40 text-xs mt-1">
                    Kosongkan jika tidak ada affiliate. Komisi 10% akan dihitung otomatis.
                  </p>
                </div>
              </div>

              {/* Notes */}
              <div className="fo-glass-card-soft rounded-lg p-4 space-y-3">
                <h4 className="text-white font-semibold mb-2">Catatan</h4>
                <div>
                  <label className="text-white/60 text-sm mb-1 block">Catatan Pasien</label>
                  <textarea
                    value={editFormData.patientNotes}
                    onChange={(e) => setEditFormData({...editFormData, patientNotes: e.target.value})}
                    rows={2}
                    className="w-full fo-glass-input px-3 py-2 rounded-lg resize-none"
                  />
                </div>
                <div>
                  <label className="text-white/60 text-sm mb-1 block">Catatan Admin</label>
                  <textarea
                    value={editFormData.adminNotes}
                    onChange={(e) => setEditFormData({...editFormData, adminNotes: e.target.value})}
                    rows={2}
                    className="w-full fo-glass-input px-3 py-2 rounded-lg resize-none"
                  />
                </div>
              </div>

              {/* Error/Success Messages */}
              {editError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-red-400 text-sm">{editError}</p>
                </div>
              )}
              {editSuccess && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                  <p className="text-green-400 text-sm">{editSuccess}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditFormData(null);
                  setEditError('');
                  setEditSuccess('');
                }}
                className="flex-1 fo-glass-card-soft text-white py-3 rounded-lg hover:bg-white/10 transition-colors font-semibold"
              >
                Batal
              </button>
              <button
                onClick={handleEditReservation}
                disabled={!editFormData.patientName || !editFormData.patientEmail || !editFormData.treatmentId}
                className="flex-1 fo-glass-card-soft border-primary/35 text-primary py-3 rounded-lg hover:bg-primary/20 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && reservationToDelete && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="fo-glass-modal border-red-500/35 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-playfair text-2xl font-bold text-white">
                Konfirmasi Hapus
              </h3>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setReservationToDelete(null);
                  setDeleteError('');
                }}
                className="text-white/60 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-400 font-semibold mb-2">
                  ⚠️ Peringatan
                </p>
                <p className="text-white/80 text-sm">
                  Anda akan menghapus reservasi ini secara permanen. Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>

              <div className="fo-glass-card-soft rounded-lg p-4 space-y-2">
                <div>
                  <p className="text-white/60 text-xs">Pasien</p>
                  <p className="text-white font-semibold">{reservationToDelete.patientName}</p>
                </div>
                <div>
                  <p className="text-white/60 text-xs">Treatment</p>
                  <p className="text-white">{reservationToDelete.treatment.name}</p>
                </div>
                <div>
                  <p className="text-white/60 text-xs">Tanggal</p>
                  <p className="text-white">{formatDate(reservationToDelete.reservationDate)} - {reservationToDelete.reservationTime}</p>
                </div>
                {(reservationToDelete.referrer || reservationToDelete.referredBy) && (
                  <div>
                    <p className="text-white/60 text-xs">Affiliate</p>
                    {reservationToDelete.referrer && (
                      <p className="text-white/70 text-xs">Nama Afiliator: {getAffiliateFullName(reservationToDelete.referrer)}</p>
                    )}
                    <p className="text-primary font-semibold">
                      Kode: {reservationToDelete.referrer?.affiliateCode || reservationToDelete.referredBy}
                      {!reservationToDelete.referrer && reservationToDelete.referredBy && (
                        <span className="text-yellow-400 text-xs ml-2">(Unclaimed)</span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              {deleteError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-red-400 text-sm">{deleteError}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setReservationToDelete(null);
                  setDeleteError('');
                }}
                className="flex-1 fo-glass-card-soft text-white py-3 rounded-lg hover:bg-white/10 transition-colors font-semibold"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteReservation}
                className="flex-1 bg-red-500/20 border border-red-500/30 text-red-400 py-3 rounded-lg hover:bg-red-500/30 transition-colors font-semibold"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedReservation && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="fo-glass-modal rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-playfair text-2xl font-bold text-white">
                Input Total Pembayaran
              </h3>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentAmount('');
                }}
                className="text-white/60 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <p className="text-white/60 text-sm mb-1">Patient</p>
                <p className="text-white font-semibold">{selectedReservation.patientName}</p>
              </div>
              <div>
                <p className="text-white/60 text-sm mb-1">Treatment</p>
                <p className="text-white">{selectedReservation.treatment.name}</p>
              </div>
              <div>
                <p className="text-white/60 text-sm mb-1">Original Price</p>
                <p className="text-primary font-bold">{formatCurrency(selectedReservation.originalPrice)}</p>
              </div>
              
              {selectedReservation.referrer && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                  <p className="text-green-400 text-sm font-semibold mb-1">
                    ✓ Ada referral dari {getAffiliateFullName(selectedReservation.referrer)}
                  </p>
                  <p className="text-white/80 text-xs mb-1 font-mono">
                    Kode Afiliator: {selectedReservation.referrer.affiliateCode}
                  </p>
                  <p className="text-white/60 text-xs">
                    Komisi 10% akan otomatis dihitung dari total pembayaran
                  </p>
                </div>
              )}

              <div>
                <label className="text-white font-semibold mb-2 block">
                  Total Pembayaran Aktual *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-semibold">
                    Rp
                  </span>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0"
                    className="w-full fo-glass-input border-2 border-primary/30 pl-12 pr-4 py-3 rounded-lg text-lg font-semibold"
                  />
                </div>
                <p className="text-white/40 text-xs mt-1">
                  Masukkan jumlah yang dibayarkan pasien (bisa berbeda dari harga asli karena promo/diskon)
                </p>
              </div>

              {paymentAmount && parseFloat(paymentAmount) > 0 && selectedReservation.referrer && (
                <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
                  <p className="text-white/60 text-xs mb-1">Komisi untuk Afiliator:</p>
                  <p className="text-primary font-bold text-lg">
                    {formatCurrency(parseFloat(paymentAmount) * 0.10)}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentAmount('');
                }}
                className="flex-1 fo-glass-card-soft text-white py-3 rounded-lg hover:bg-white/10 transition-colors font-semibold"
              >
                Batal
              </button>
              <button
                onClick={handleCompleteWithPayment}
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
                className="flex-1 bg-green-500/20 border border-green-500/30 text-green-400 py-3 rounded-lg hover:bg-green-500/30 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Selesaikan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
