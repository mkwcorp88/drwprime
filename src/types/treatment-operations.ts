import type { OpsPatientSource, OpsRole } from '@prisma/client';

export type OpsStaffView = {
  id: string;
  branchId: string | null;
  employeeId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  role: OpsRole;
  branch?: { id: string; name: string } | null;
};

export type OpsActionView = {
  id: string;
  actionNameSnapshot: string;
  sequenceNumber: number;
  isRequired: boolean;
  requiredRoleSnapshot?: string | null;
  status: string;
  assignedTherapistId: string | null;
  performedByTherapistId: string | null;
  incentiveValueSnapshot: number;
  calculatedIncentive: number | null;
  startedAt: string | null;
  completedAt: string | null;
  assignedTherapist?: { id: string; name: string } | null;
  performedTherapist?: { id: string; name: string } | null;
};

export type OpsOrderView = {
  id: string;
  orderNumber: string;
  branchId: string;
  patientNameSnapshot: string;
  treatmentNameSnapshot: string;
  visitDate: string;
  scheduledAt: string | null;
  finalPrice: number;
  status: string;
  patient?: { id: string; patientNumber: string; name: string };
  doctor?: { id: string; name: string } | null;
  actions: OpsActionView[];
};

export type OpsBootstrap = {
  staff: OpsStaffView;
  branches: Array<{ id: string; code: string; name: string }>;
  treatments: Array<{
    id: string;
    code: string;
    name: string;
    category: string | null;
    defaultPrice: number;
    active: boolean;
    actionTemplates: Array<{ id: string; actionName: string; sequenceNumber: number; incentiveValue: number }>;
  }>;
  doctors: Array<{ id: string; branchId: string; name: string }>;
  therapists: Array<{ id: string; branchId: string | null; employeeId: string; name: string }>;
  assignableStaff: Array<{ id: string; branchId: string | null; employeeId: string; name: string; role: string }>;
  patients: Array<{ id: string; branchId: string; patientNumber: string; name: string; source: OpsPatientSource }>;
};

export type OpsTreatmentActionTemplateView = {
  id: string;
  actionName: string;
  sequenceNumber: number;
  isRequired: boolean;
  requiredRole: string | null;
  estimatedDurationMinutes: number | null;
  incentiveType: string;
  incentiveValue: number;
  active: boolean;
};

export type OpsTreatmentView = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  defaultPrice: number;
  active: boolean;
  protocolId: string | null;
  mappingStatus: string;
  requiresDoctor: boolean | null;
  staffFeeIdr: number | null;
  doctorFeeIdr: number | null;
  protocol?: { id: string; code: string; name: string } | null;
  actionTemplates: OpsTreatmentActionTemplateView[];
};
