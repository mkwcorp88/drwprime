'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import InstallPrompt from '@/components/InstallPrompt';
import { Hourglass } from '@/components/LoadingScreen';
import type { Reservation, Treatment, EditFormData } from '@/types/front-office';
import QuickActions from '@/components/front-office/QuickActions';
import StatusTracker from '@/components/front-office/StatusTracker';
import ReservationFilter from '@/components/front-office/ReservationFilter';
import ReservationCard from '@/components/front-office/ReservationCard';
import ReservationDetailModal from '@/components/front-office/ReservationDetailModal';
import EditReservationModal from '@/components/front-office/EditReservationModal';
import PaymentModal from '@/components/front-office/PaymentModal';
import AffiliateModal from '@/components/front-office/AffiliateModal';
import DeleteModal from '@/components/front-office/DeleteModal';
import { products } from '@/data/products';

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

      setEditSuccess('Reservasi berhasil diupdate!');
      await fetchReservations();
      
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

      await fetchReservations();
      setShowDeleteModal(false);
      setReservationToDelete(null);
      setDeleteError('');
    } catch (error) {
      console.error('Error deleting reservation:', error);
      setDeleteError('Terjadi kesalahan. Silakan coba lagi.');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="min-h-screen fo-glass-page fo-theme-dashboard">
      <div className="max-w-7xl mx-auto px-5 py-10">
        {/* Header */}
        <div className="mb-8 fo-fade-up">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="font-playfair text-3xl sm:text-4xl md:text-5xl font-bold text-primary leading-tight">
                Front Office Dashboard
              </h1>
              <p className="mt-2 text-sm text-white/50 sm:text-base">
                Kelola reservasi, membership, dan operasional klinik
              </p>
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

        {/* Menu Cepat */}
        <QuickActions />

        {/* Install App (mobile, untuk FO) */}
        <InstallPrompt />

        {/* Status Tracker */}
        <StatusTracker reservations={reservations} />

        {/* Etalase Produk */}
        <section className="fo-fade-up fo-stagger-2 mx-auto mb-8 max-w-5xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
              Etalase Produk
            </p>
            <Link
              href="/product-gallery"
              className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/60 hover:text-primary transition-colors"
            >
              Lihat Semua →
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1 -mx-1 px-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            {products.map((product) => (
              <Link
                key={product.id}
                href={`/product-gallery?product=${product.id}`}
                className="fo-glass-card-soft flex-shrink-0 w-[140px] sm:w-[160px] snap-start rounded-xl p-3 text-center transition-all hover:border-primary/25 hover:bg-primary/[0.04] active:scale-[0.98]"
              >
                <div className="relative w-full aspect-square mb-2.5 overflow-hidden rounded-lg ring-1 ring-white/10">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="160px"
                  />
                </div>
                <p className="text-[11px] font-semibold leading-tight text-white/80 line-clamp-2 mb-1.5">
                  {product.name}
                </p>
                <p className="text-[10px] font-bold text-primary/70">
                  {formatCurrency(product.price)}
                </p>
              </Link>
            ))}
          </div>
        </section>

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
          <ReservationFilter
            filterStatus={filterStatus}
            filterDate={filterDate}
            onStatusChange={setFilterStatus}
            onDateChange={setFilterDate}
            onClearDate={() => setFilterDate('')}
          />

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
                <ReservationCard
                  key={reservation.id}
                  reservation={reservation}
                  isExpanded={expandedReservation === reservation.id}
                  onToggle={() => setExpandedReservation(expandedReservation === reservation.id ? null : reservation.id)}
                  onEdit={(r) => handleOpenEditModal(r)}
                  onDelete={(r) => {
                    setReservationToDelete(r);
                    setShowDeleteModal(true);
                  }}
                  onViewDetails={(r) => setSelectedReservation(r)}
                  onConfirm={(id) => updateReservationStatus(id, 'confirmed')}
                  onCancel={(id) => updateReservationStatus(id, 'cancelled')}
                  onComplete={(r) => {
                    setSelectedReservation(r);
                    setShowPaymentModal(true);
                  }}
                  treatments={treatments}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedReservation && (
        <ReservationDetailModal
          reservation={selectedReservation}
          onClose={() => setSelectedReservation(null)}
          onConfirm={(id) => updateReservationStatus(id, 'confirmed')}
          onCancel={(id) => updateReservationStatus(id, 'cancelled')}
          onCompletePayment={() => setShowPaymentModal(true)}
          onAddAffiliate={() => setShowAffiliateModal(true)}
        />
      )}

      {/* Add Affiliate Modal */}
      {showAffiliateModal && selectedReservation && (
        <AffiliateModal
          reservation={selectedReservation}
          affiliateCode={affiliateCode}
          affiliateError={affiliateError}
          onCodeChange={(code) => {
            setAffiliateCode(code);
            setAffiliateError('');
          }}
          onClose={() => {
            setShowAffiliateModal(false);
            setAffiliateCode('');
            setAffiliateError('');
          }}
          onSubmit={handleAddAffiliate}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && editFormData && (
        <EditReservationModal
          editFormData={editFormData}
          treatments={treatments}
          editError={editError}
          editSuccess={editSuccess}
          onClose={() => {
            setShowEditModal(false);
            setEditFormData(null);
            setEditError('');
            setEditSuccess('');
          }}
          onSave={handleEditReservation}
          onFormChange={setEditFormData}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && reservationToDelete && (
        <DeleteModal
          reservation={reservationToDelete}
          deleteError={deleteError}
          onClose={() => {
            setShowDeleteModal(false);
            setReservationToDelete(null);
            setDeleteError('');
          }}
          onConfirm={handleDeleteReservation}
        />
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedReservation && (
        <PaymentModal
          reservation={selectedReservation}
          paymentAmount={paymentAmount}
          onAmountChange={setPaymentAmount}
          onClose={() => {
            setShowPaymentModal(false);
            setPaymentAmount('');
          }}
          onSubmit={handleCompleteWithPayment}
        />
      )}
    </div>
  );
}
