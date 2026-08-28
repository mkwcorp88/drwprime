export type OpsStaffView = {
  id: string;
  branchId: string | null;
  employeeId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  role: 'SUPER_ADMIN' | 'MANAGEMENT' | 'FRONT_OFFICE' | 'SUPERVISOR' | 'THERAPIST' | 'DOCTOR';
  branch?: { id: string; name: string } | null;
};

export type OpsActionView = {
  id: string;
  actionNameSnapshot: string;
  sequenceNumber: number;
  isRequired: boolean;
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
    defaultPrice: number;
    actionTemplates: Array<{ id: string; actionName: string; sequenceNumber: number; incentiveValue: number }>;
  }>;
  doctors: Array<{ id: string; branchId: string; name: string }>;
  therapists: Array<{ id: string; branchId: string | null; employeeId: string; name: string }>;
  patients: Array<{ id: string; branchId: string; patientNumber: string; name: string }>;
};
