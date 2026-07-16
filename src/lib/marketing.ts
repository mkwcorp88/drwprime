// Shared types & constants for the Digital Marketing Dashboard
// (Derma Rich Wellness — marketing subdomain of DRW Prime).

export const ASSIGNMENT_TYPES = [
  { value: 'design_request', label: 'Request Desain' },
  { value: 'rebranding', label: 'Project Rebranding' },
  { value: 'content', label: 'Konten' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'other', label: 'Lainnya' },
] as const;

export const ASSIGNMENT_STATUSES = [
  { value: 'todo', label: 'To Do', color: '#9ca3af' },
  { value: 'in_progress', label: 'Dikerjakan', color: '#3b82f6' },
  { value: 'review', label: 'Review', color: '#a855f7' },
  { value: 'done', label: 'Selesai', color: '#22c55e' },
  { value: 'cancelled', label: 'Dibatalkan', color: '#ef4444' },
] as const;

export const ASSIGNMENT_PRIORITIES = [
  { value: 'low', label: 'Rendah', color: '#9ca3af' },
  { value: 'medium', label: 'Sedang', color: '#d4af37' },
  { value: 'high', label: 'Tinggi', color: '#f97316' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
] as const;

export type AssignmentType = (typeof ASSIGNMENT_TYPES)[number]['value'];
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number]['value'];
export type AssignmentPriority = (typeof ASSIGNMENT_PRIORITIES)[number]['value'];

export interface MarketingComment {
  id: string;
  assignmentId: string;
  authorClerkId: string | null;
  authorName: string | null;
  body: string;
  createdAt: string;
}

export interface MarketingAssignment {
  id: string;
  title: string;
  type: AssignmentType;
  description: string | null;
  status: AssignmentStatus;
  priority: AssignmentPriority;
  progress: number;
  assigneeClerkId: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  requesterClerkId: string | null;
  requesterName: string | null;
  dueDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  tags: string[];
  attachments: string[];
  createdAt: string;
  updatedAt: string;
  comments?: MarketingComment[];
}

export function typeLabel(value: string): string {
  return ASSIGNMENT_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function statusMeta(value: string) {
  return (
    ASSIGNMENT_STATUSES.find((s) => s.value === value) ?? {
      value,
      label: value,
      color: '#9ca3af',
    }
  );
}

export function priorityMeta(value: string) {
  return (
    ASSIGNMENT_PRIORITIES.find((p) => p.value === value) ?? {
      value,
      label: value,
      color: '#9ca3af',
    }
  );
}

export function isValidType(v: unknown): v is AssignmentType {
  return ASSIGNMENT_TYPES.some((t) => t.value === v);
}

export function isValidStatus(v: unknown): v is AssignmentStatus {
  return ASSIGNMENT_STATUSES.some((s) => s.value === v);
}

export function isValidPriority(v: unknown): v is AssignmentPriority {
  return ASSIGNMENT_PRIORITIES.some((p) => p.value === v);
}
