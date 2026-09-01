import type { OpsManualPatientReason, OpsRole } from '@prisma/client';

export const OPS_ROLES = [
  'SUPER_ADMIN',
  'FINANCE',
  'MANAGEMENT',
  'FRONT_OFFICE',
  'SUPERVISOR',
  'THERAPIST',
  'DOCTOR',
  'APOTEKER',
  'ASISTEN_APOTEKER',
  'PERAWAT',
] as const satisfies readonly OpsRole[];

export const ORDER_MANAGEMENT_ROLES: OpsRole[] = ['SUPER_ADMIN', 'MANAGEMENT', 'FRONT_OFFICE', 'SUPERVISOR'];
export const MANUAL_PATIENT_ENTRY_ROLES: OpsRole[] = ['SUPER_ADMIN', 'MANAGEMENT', 'FRONT_OFFICE', 'SUPERVISOR'];
export const MANUAL_PATIENT_REASON_CODES = [
  'AIDO_UNAVAILABLE',
  'NOT_IN_AIDO',
  'AIDO_DATA_MISMATCH',
  'OTHER',
] as const satisfies readonly OpsManualPatientReason[];
export type ManualPatientReasonCode = (typeof MANUAL_PATIENT_REASON_CODES)[number];
export const manualPatientReasonLabels: Record<ManualPatientReasonCode, string> = {
  AIDO_UNAVAILABLE: 'AIDO lambat atau gagal',
  NOT_IN_AIDO: 'Pasien belum terdaftar di AIDO',
  AIDO_DATA_MISMATCH: 'Data AIDO tidak sesuai',
  OTHER: 'Lainnya',
};
export const REPORT_ROLES: OpsRole[] = ['SUPER_ADMIN', 'FINANCE', 'MANAGEMENT', 'FRONT_OFFICE', 'SUPERVISOR'];
export const INCENTIVE_MANAGEMENT_ROLES: OpsRole[] = ['SUPER_ADMIN', 'FINANCE'];
export const GLOBAL_REPORT_ROLES: OpsRole[] = ['SUPER_ADMIN', 'FINANCE'];

export const roleLabels: Record<OpsRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  FINANCE: 'Finance',
  MANAGEMENT: 'Manajemen',
  FRONT_OFFICE: 'Front Office',
  SUPERVISOR: 'Supervisor',
  THERAPIST: 'Terapis',
  DOCTOR: 'Dokter',
  APOTEKER: 'Apoteker',
  ASISTEN_APOTEKER: 'Asisten Apoteker',
  PERAWAT: 'Perawat',
};

export const orderStatusLabels = {
  DRAFT: 'Draft',
  CREATED: 'Dibuat',
  ASSIGNED: 'Ditugaskan',
  ON_PROCESS: 'Sedang Berjalan',
  WAITING_NEXT_ACTION: 'Menunggu Tindakan',
  COMPLETED: 'Selesai',
  VERIFIED: 'Terverifikasi',
  CANCELLED: 'Dibatalkan',
} as const;

export const actionStatusLabels = {
  PENDING: 'Menunggu',
  ASSIGNED: 'Ditugaskan',
  ON_PROCESS: 'Sedang Berjalan',
  COMPLETED: 'Selesai',
  SKIPPED: 'Dilewati',
  CANCELLED: 'Dibatalkan',
} as const;
