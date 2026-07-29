export interface Reservation {
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

export interface Treatment {
  id: string;
  name: string;
  categoryName: string;
}

export interface EditFormData {
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
