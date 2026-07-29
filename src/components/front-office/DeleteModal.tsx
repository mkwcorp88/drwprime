'use client';

import type { Reservation } from '@/types/front-office';
import { formatDate, getAffiliateFullName } from '@/lib/front-office-utils';

export default function DeleteModal({
  reservation,
  deleteError,
  onClose,
  onConfirm,
}: {
  reservation: Reservation;
  deleteError: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="fo-glass-modal border-red-500/35 rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-playfair text-2xl font-bold text-white">
            Konfirmasi Hapus
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
              <p className="text-white font-semibold">{reservation.patientName}</p>
            </div>
            <div>
              <p className="text-white/60 text-xs">Treatment</p>
              <p className="text-white">{reservation.treatment.name}</p>
            </div>
            <div>
              <p className="text-white/60 text-xs">Tanggal</p>
              <p className="text-white">{formatDate(reservation.reservationDate)} - {reservation.reservationTime}</p>
            </div>
            {(reservation.referrer || reservation.referredBy) && (
              <div>
                <p className="text-white/60 text-xs">Affiliate</p>
                {reservation.referrer && (
                  <p className="text-white/70 text-xs">Nama Afiliator: {getAffiliateFullName(reservation.referrer)}</p>
                )}
                <p className="text-primary font-semibold">
                  Kode: {reservation.referrer?.affiliateCode || reservation.referredBy}
                  {!reservation.referrer && reservation.referredBy && (
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
            onClick={onClose}
            className="flex-1 fo-glass-card-soft text-white py-3 rounded-lg hover:bg-white/10 transition-colors font-semibold"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-500/20 border border-red-500/30 text-red-400 py-3 rounded-lg hover:bg-red-500/30 transition-colors font-semibold"
          >
            Ya, Hapus
          </button>
        </div>
      </div>
    </div>
  );
}
