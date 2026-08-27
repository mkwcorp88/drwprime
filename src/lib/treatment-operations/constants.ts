import type { OpsRole } from '@prisma/client';

export const OPS_ROLES = [
  'SUPER_ADMIN',
  'MANAGEMENT',
  'FRONT_OFFICE',
  'SUPERVISOR',
  'THERAPIST',
  'DOCTOR',
] as const satisfies readonly OpsRole[];

export const ORDER_MANAGEMENT_ROLES: OpsRole[] = ['SUPER_ADMIN', 'FRONT_OFFICE', 'SUPERVISOR'];
export const REPORT_ROLES: OpsRole[] = ['SUPER_ADMIN', 'MANAGEMENT', 'FRONT_OFFICE', 'SUPERVISOR'];

export const roleLabels: Record<OpsRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  MANAGEMENT: 'Manajemen',
  FRONT_OFFICE: 'Front Office',
  SUPERVISOR: 'Supervisor',
  THERAPIST: 'Terapis',
  DOCTOR: 'Dokter',
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
