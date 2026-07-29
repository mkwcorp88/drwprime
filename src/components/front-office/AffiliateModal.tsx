'use client';

import type { Reservation } from '@/types/front-office';

export default function AffiliateModal({
  reservation,
  affiliateCode,
  affiliateError,
  onCodeChange,
  onClose,
  onSubmit,
}: {
  reservation: Reservation;
  affiliateCode: string;
  affiliateError: string;
  onCodeChange: (code: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="fo-glass-modal rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-playfair text-2xl font-bold text-white">
            Tambah Affiliate
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
            <label className="text-white font-semibold mb-2 block">
              Kode Affiliate *
            </label>
            <input
              type="text"
              value={affiliateCode}
              onChange={(e) => {
                onCodeChange(e.target.value.toUpperCase());
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
            onClick={onClose}
            className="flex-1 fo-glass-card-soft text-white py-3 rounded-lg hover:bg-white/10 transition-colors font-semibold"
          >
            Batal
          </button>
          <button
            onClick={onSubmit}
            disabled={!affiliateCode}
            className="flex-1 fo-glass-card-soft border-primary/35 text-primary py-3 rounded-lg hover:bg-primary/20 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
