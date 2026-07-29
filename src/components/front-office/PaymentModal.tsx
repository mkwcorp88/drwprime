'use client';

import type { Reservation } from '@/types/front-office';
import { formatCurrency, getAffiliateFullName } from '@/lib/front-office-utils';

export default function PaymentModal({
  reservation,
  paymentAmount,
  onAmountChange,
  onClose,
  onSubmit,
}: {
  reservation: Reservation;
  paymentAmount: string;
  onAmountChange: (amount: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="fo-glass-modal rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-playfair text-2xl font-bold text-white">
            Input Total Pembayaran
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
            <p className="text-white/60 text-sm mb-1">Patient</p>
            <p className="text-white font-semibold">{reservation.patientName}</p>
          </div>
          <div>
            <p className="text-white/60 text-sm mb-1">Treatment</p>
            <p className="text-white">{reservation.treatment.name}</p>
          </div>
          <div>
            <p className="text-white/60 text-sm mb-1">Original Price</p>
            <p className="text-primary font-bold">{formatCurrency(reservation.originalPrice)}</p>
          </div>
          
          {reservation.referrer && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
              <p className="text-green-400 text-sm font-semibold mb-1">
                ✓ Ada referral dari {getAffiliateFullName(reservation.referrer)}
              </p>
              <p className="text-white/80 text-xs mb-1 font-mono">
                Kode Afiliator: {reservation.referrer.affiliateCode}
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
                onChange={(e) => onAmountChange(e.target.value)}
                placeholder="0"
                className="w-full fo-glass-input border-2 border-primary/30 pl-12 pr-4 py-3 rounded-lg text-lg font-semibold"
              />
            </div>
            <p className="text-white/40 text-xs mt-1">
              Masukkan jumlah yang dibayarkan pasien (bisa berbeda dari harga asli karena promo/diskon)
            </p>
          </div>

          {paymentAmount && parseFloat(paymentAmount) > 0 && reservation.referrer && (
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
            onClick={onClose}
            className="flex-1 fo-glass-card-soft text-white py-3 rounded-lg hover:bg-white/10 transition-colors font-semibold"
          >
            Batal
          </button>
          <button
            onClick={onSubmit}
            disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
            className="flex-1 bg-green-500/20 border border-green-500/30 text-green-400 py-3 rounded-lg hover:bg-green-500/30 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Selesaikan
          </button>
        </div>
      </div>
    </div>
  );
}
