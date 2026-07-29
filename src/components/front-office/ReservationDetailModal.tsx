'use client';

import type { Reservation } from '@/types/front-office';
import { formatCurrency, formatDate, getAffiliateFullName } from '@/lib/front-office-utils';

export default function ReservationDetailModal({
  reservation,
  onClose,
  onConfirm,
  onCancel,
  onCompletePayment,
  onAddAffiliate,
}: {
  reservation: Reservation;
  onClose: () => void;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  onCompletePayment: () => void;
  onAddAffiliate: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="fo-glass-modal rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-playfair text-2xl font-bold text-white">
            Reservation Details
          </h3>
          <button
            onClick={onClose}
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
            <p className="text-white font-semibold">{reservation.patientName}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-white/60 text-sm mb-1">Phone</p>
              <p className="text-white">{reservation.patientPhone}</p>
            </div>
            <div>
              <p className="text-white/60 text-sm mb-1">Email</p>
              <p className="text-white">{reservation.patientEmail}</p>
            </div>
          </div>
          <div>
            <p className="text-white/60 text-sm mb-1">Treatment</p>
            <p className="text-white font-semibold">
              {reservation.treatment.category.name} - {reservation.treatment.name}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-white/60 text-sm mb-1">Date</p>
              <p className="text-white">{formatDate(reservation.reservationDate)}</p>
            </div>
            <div>
              <p className="text-white/60 text-sm mb-1">Time</p>
              <p className="text-white">{reservation.reservationTime}</p>
            </div>
          </div>
          <div>
            <p className="text-white/60 text-sm mb-1">Price</p>
            <p className="text-primary font-bold text-xl">
              {formatCurrency(reservation.finalPrice)}
            </p>
          </div>
          {reservation.patientNotes && (
            <div>
              <p className="text-white/60 text-sm mb-1">Patient Notes</p>
              <p className="text-white">{reservation.patientNotes}</p>
            </div>
          )}
          {reservation.referrer || reservation.referredBy ? (
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
              <p className="text-primary font-semibold mb-2">Affiliate</p>
              {reservation.referrer && (
                <p className="text-white/80 text-sm mb-1">Nama Afiliator: {getAffiliateFullName(reservation.referrer)}</p>
              )}
              <p className="text-white text-lg font-bold font-mono">Kode: {' '}
                {reservation.referrer?.affiliateCode || reservation.referredBy}
              </p>
              {!reservation.referrer && reservation.referredBy && (
                <p className="text-yellow-400 text-sm mt-1">Unclaimed Code</p>
              )}
              <p className="text-green-400 text-sm mt-2">
                Commission: {formatCurrency(reservation.commissionAmount)}
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
                  onClick={onAddAffiliate}
                  className="bg-primary/20 border border-primary/30 text-primary px-4 py-2 rounded-lg hover:bg-primary/30 transition-colors text-sm font-semibold whitespace-nowrap"
                >
                  + Add Referrer
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {reservation.status === 'pending' && (
          <div className="flex gap-3">
            <button
              onClick={() => onConfirm(reservation.id)}
              className="flex-1 bg-blue-500/20 border border-blue-500/30 text-blue-400 py-3 rounded-lg hover:bg-blue-500/30 transition-colors font-semibold"
            >
              Confirm
            </button>
            <button
              onClick={() => onCancel(reservation.id)}
              className="flex-1 bg-red-500/20 border border-red-500/30 text-red-400 py-3 rounded-lg hover:bg-red-500/30 transition-colors font-semibold"
            >
              Cancel
            </button>
          </div>
        )}
        {reservation.status === 'confirmed' && (
          <button
            onClick={onCompletePayment}
            className="w-full bg-green-500/20 border border-green-500/30 text-green-400 py-3 rounded-lg hover:bg-green-500/30 transition-colors font-semibold"
          >
            Complete with Payment
          </button>
        )}
      </div>
    </div>
  );
}
