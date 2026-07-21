'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';

interface ReservationFormProps {
  treatmentId: string;
  treatmentName: string;
  treatmentPrice: number;
  onClose: () => void;
}

export default function ReservationForm({
  treatmentId,
  treatmentName,
  treatmentPrice,
  onClose
}: ReservationFormProps) {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    patientName: user?.fullName || '',
    email: user?.emailAddresses[0]?.emailAddress || '',
    phone: '',
    preferredDate: '',
    preferredTime: '',
    notes: '',
    affiliateCode: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          treatmentId,
          patientName: formData.patientName,
          patientEmail: formData.email,
          patientPhone: formData.phone,
          preferredDate: new Date(formData.preferredDate),
          preferredTime: formData.preferredTime,
          notes: formData.notes,
          referralCode: formData.affiliateCode || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create reservation');
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      let cleaned = value.replace(/\D/g, '');
      if (cleaned.startsWith('08')) {
        cleaned = '62' + cleaned.substring(1);
      } else if (cleaned.startsWith('8') && !cleaned.startsWith('62')) {
        cleaned = '62' + cleaned;
      }
      setFormData((prev) => ({ ...prev, phone: cleaned }));
      return;
    }
    setFormData({
      ...formData,
      [name]: value
    });
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full text-center">
          <div className="mb-4">
            <svg
              className="w-16 h-16 text-green-500 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            Reservation Successful!
          </h3>
          <p className="text-gray-600">
            Your reservation has been submitted. We&apos;ll contact you soon to confirm.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full my-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Book Treatment
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg border border-[#d4af37]">
          <h3 className="font-semibold text-gray-900">{treatmentName}</h3>
          <p className="text-[#d4af37] font-bold">
            Rp {treatmentPrice.toLocaleString('id-ID')}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <input
                type="text"
                name="patientName"
                value={formData.patientName}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
                placeholder="Your full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
                placeholder="your@email.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number *
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              maxLength={15}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
              placeholder="08123456789"
            />
            <p className="mt-1 text-xs text-gray-500">
              Ketik 08xxx akan otomatis jadi 62xxx
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Date *
              </label>
              <input
                type="date"
                name="preferredDate"
                value={formData.preferredDate}
                onChange={handleChange}
                required
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Time *
              </label>
              <input
                type="time"
                name="preferredTime"
                value={formData.preferredTime}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Affiliate Code (Optional)
            </label>
            <input
              type="text"
              name="affiliateCode"
              value={formData.affiliateCode}
              onChange={handleChange}
              maxLength={5}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
              placeholder="Enter 5-digit code (e.g., AB123)"
            />
            <p className="mt-1 text-sm text-gray-500">
              Have an affiliate code? Enter it to give credit to your referrer
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
              placeholder="Any special requests or concerns?"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-[#d4af37] to-[#f4d03f] text-white font-semibold rounded-lg hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Reservation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
