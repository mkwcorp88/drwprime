'use client';

import type { Reservation, Treatment } from '@/types/front-office';
import { getStatusColor, formatCurrency, formatDate, getAffiliateFullName } from '@/lib/front-office-utils';

export interface ReservationCardProps {
  reservation: Reservation;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (r: Reservation) => void;
  onDelete: (r: Reservation) => void;
  onViewDetails: (r: Reservation) => void;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  onComplete: (r: Reservation) => void;
  treatments: Treatment[];
}

export default function ReservationCard({
  reservation,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onViewDetails,
  onConfirm,
  onCancel,
  onComplete,
}: ReservationCardProps) {
  return (
    <div
      className="fo-ios-card overflow-hidden"
    >
      {/* Collapsed Header */}
      <div
        className="flex items-start justify-between p-4 md:p-5 cursor-pointer hover:bg-white/5 transition-all"
        onClick={onToggle}
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
          className={`w-5 h-5 text-white/60 ml-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
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
                onEdit(reservation);
              }}
              className="fo-ios-btn fo-ios-btn-neutral"
            >
              Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(reservation);
              }}
              className="fo-ios-btn fo-ios-btn-danger"
            >
              Delete
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(reservation);
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
                    onConfirm(reservation.id);
                  }}
                  className="fo-ios-btn fo-ios-btn-info"
                >
                  Confirm
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel(reservation.id);
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
                  onComplete(reservation);
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
  );
}
