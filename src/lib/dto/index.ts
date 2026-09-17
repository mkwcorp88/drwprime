/**
 * Shared request/response types used across API routes and pages.
 * Add new DTOs here — both server and client may import these.
 */

// --- Membership ---

export type MembershipTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export interface MemberProfile {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  nik: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  isComplete: boolean;
  profileCompletedAt: string | null;
}

export interface MembershipSummary {
  tier: MembershipTier;
  benefits: string[];
  nextTier: MembershipTier | null;
  nextTierThreshold: number | null;
  progressPercent: number;
  amountToNextTier: number | null;
  totalSpending: number;
  memberSince: string;
  isTeamLeader: boolean;
  points: number;
  pointHistory: PointHistoryItem[];
  reservations: ReservationHistoryItem[];
}

export interface PointHistoryItem {
  id: string;
  amount: number;
  treatment: string | null;
  spendingDate: string;
  pointsEarned: number;
}

export interface ReservationHistoryItem {
  id: string;
  patientName: string;
  treatmentName: string | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  reservationDate: string;
  finalPrice: number;
}

// --- Reservation ---

export interface ReservationDetail {
  id: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  patientNotes: string | null;
  reservationDate: string;
  reservationTime: string;
  status: string;
  originalPrice: number;
  finalPrice: number;
  commissionAmount: number;
  adminNotes: string | null;
  referredBy: string | null;
  treatmentName: string;
  categoryName: string;
  referrerName: string | null;
  referrerCode: string | null;
  createdAt: string;
}

// --- Affiliate ---

export interface AffiliateCodeData {
  id: string;
  code: string;
  assignedEmail: string | null;
  claimedBy: string | null;
  claimedAt: string | null;
  usageCount: number;
  status: 'unclaimed' | 'claimed';
  totalCommission: number;
  claimedByName: string | null;
  claimedByPhone: string | null;
  notes: string | null;
}
