'use client';

import type { EditFormData, Treatment } from '@/types/front-office';

export default function EditReservationModal({
  editFormData,
  treatments,
  editError,
  editSuccess,
  onClose,
  onSave,
  onFormChange,
}: {
  editFormData: EditFormData;
  treatments: Treatment[];
  editError: string;
  editSuccess: string;
  onClose: () => void;
  onSave: () => void;
  onFormChange: (data: EditFormData) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="fo-glass-modal rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-playfair text-2xl font-bold text-white">
            Edit Reservasi
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
          {/* Patient Info */}
          <div className="fo-glass-card-soft rounded-lg p-4 space-y-3">
            <h4 className="text-white font-semibold mb-2">Informasi Pasien</h4>
            <div>
              <label className="text-white/60 text-sm mb-1 block">Nama Pasien *</label>
              <input
                type="text"
                value={editFormData.patientName}
                onChange={(e) => onFormChange({...editFormData, patientName: e.target.value})}
                className="w-full fo-glass-input px-3 py-2 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-white/60 text-sm mb-1 block">Email *</label>
                <input
                  type="email"
                  value={editFormData.patientEmail}
                  onChange={(e) => onFormChange({...editFormData, patientEmail: e.target.value})}
                  className="w-full fo-glass-input px-3 py-2 rounded-lg"
                />
              </div>
              <div>
                <label className="text-white/60 text-sm mb-1 block">Phone *</label>
                <input
                  type="tel"
                  value={editFormData.patientPhone}
                  onChange={(e) => onFormChange({...editFormData, patientPhone: e.target.value})}
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
                  onChange={(e) => onFormChange({...editFormData, reservationDate: e.target.value})}
                  className="w-full fo-glass-input px-3 py-2 rounded-lg [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="text-white/60 text-sm mb-1 block">Waktu *</label>
                <input
                  type="time"
                  value={editFormData.reservationTime}
                  onChange={(e) => onFormChange({...editFormData, reservationTime: e.target.value})}
                  className="w-full fo-glass-input px-3 py-2 rounded-lg [color-scheme:dark]"
                />
              </div>
            </div>
            <div>
              <label className="text-white/60 text-sm mb-1 block">Treatment *</label>
              <select
                value={editFormData.treatmentId}
                onChange={(e) => onFormChange({...editFormData, treatmentId: e.target.value})}
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
                  onChange={(e) => onFormChange({...editFormData, status: e.target.value})}
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
                  onChange={(e) => onFormChange({...editFormData, finalPrice: parseFloat(e.target.value)})}
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
                onChange={(e) => onFormChange({...editFormData, affiliateCode: e.target.value.toUpperCase()})}
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
                onChange={(e) => onFormChange({...editFormData, patientNotes: e.target.value})}
                rows={2}
                className="w-full fo-glass-input px-3 py-2 rounded-lg resize-none"
              />
            </div>
            <div>
              <label className="text-white/60 text-sm mb-1 block">Catatan Admin</label>
              <textarea
                value={editFormData.adminNotes}
                onChange={(e) => onFormChange({...editFormData, adminNotes: e.target.value})}
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
            onClick={onClose}
            className="flex-1 fo-glass-card-soft text-white py-3 rounded-lg hover:bg-white/10 transition-colors font-semibold"
          >
            Batal
          </button>
          <button
            onClick={onSave}
            disabled={!editFormData.patientName || !editFormData.patientEmail || !editFormData.treatmentId}
            className="flex-1 fo-glass-card-soft border-primary/35 text-primary py-3 rounded-lg hover:bg-primary/20 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Simpan Perubahan
          </button>
        </div>
      </div>
    </div>
  );
}
