import type { CrmRole } from '@/lib/crm/constants';
export type Actor = { id: string; name: string; role: CrmRole };
export type Item = { id: string; name: string };
export type EventItem = Item & { eventDate: string; leads: number; contacted: number; reservations: number; attended: number; revenue: number };
export type Campaign = Item & { platform: string; status: string };
export type Bootstrap = { actor: Actor; role: CrmRole; events: EventItem[]; campaigns: Campaign[]; assignees: (Item & { role: string })[]; treatments: (Item & { price: string })[]; ocrReady: boolean };
export type FollowUp = { id: string; status: string; note: string; actorName: string; event: EventItem | null; createdAt: string; nextFollowUp: string | null };
export type Lead = { id: string; name: string; phone: string; phoneNormalized: string; source: string; eventId: string | null; campaignId: string | null; assignedTo: string | null; status: string; interest: string | null; notes: string | null; nextFollowUp: string | null; revision: number; event: EventItem | null; campaign: Campaign | null; picName?: string | null; _count?: { reservations: number }; events?: { event: EventItem }[]; followUps?: FollowUp[]; reservations?: Booking[] };
export type Booking = { reservationId: string; source: string; visitResult: string; cancellationReason: string | null; rescheduledAt: string | null; createdAt: string; event: EventItem | null; campaign: Campaign | null; history?: { id: string; action: string; actorName: string; createdAt: string }[]; lead?: { id: string; name: string; phone: string }; reservation: { id: string; status: string; patientName: string; patientPhone: string; reservationDate: string; reservationTime: string; finalPrice: string; treatment: Item } };
export type LeadList = { rows: Lead[]; total: number; page: number; summary: { all: number; fresh: number; due: number; unassigned: number } };
export type Dashboard = { all: number; fresh: number; due: number; unassigned: number; activeReservations: number; completed: number; ads: Totals };
export type UnattributedReservation = { id:string; patientName:string; patientPhone:string; treatmentName:string; reservationDate:string; reservationTime:string; status:string; createdAt:string };
export type AdsTracker = { from:string; to:string; campaignId:string; status:string; q:string; page:number; total: { total:number; pending:number; confirmed:number; completed:number; cancelled:number; noShow:number; revenue:number }; spend:number; spendEntries:number; roas:number|null; rows:Booking[]; unattributed:UnattributedReservation[] };
export type Totals = { spend: number; spendEntries: number; reservations: number; attended: number; treatment: number; cancelled: number; noShow: number; revenue: number; resultComplete: number; incomplete: number; due: number };
export type Group = Totals & { id: string; name: string; platform: string };
export type Report = { from: string; to: string; total: Totals; groups: Group[] };
export type Spend = { id: string; amount: string; spendDate: string; campaign: Campaign };
export type Staff = { id: string; name: string; email: string | null; phone: string | null; crmGrant: { role: CrmRole; active: boolean } | null };
export type ImportRow = { name: string; phone: string; interest: string; notes: string; file: string; selected: boolean; duplicate: { id: string; name: string } | null; repeated: boolean; invalidPhone: boolean };
export type ImportBatch = { id: string; rows: ImportRow[]; files: { id: string; name: string; mime: string }[] };
export type LeadFilters = { q: string; status: string; source: string; eventId: string; work: string; page: number };

export async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...options });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Permintaan belum berhasil. Silakan coba lagi.');
  return result as T;
}
export function action<T>(name: string, data: Record<string, unknown> = {}): Promise<T> {
  return request<T>('/api/crm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: name, ...data }) });
}
export const dateText = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';
export const dateInput = (value: string | null | undefined) => value ? value.slice(0, 10) : '';
export const money = (value: string | number) => `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(value) || 0)}`;
export const label = (choices: Record<string, string>, value: string | null | undefined) => value ? choices[value] || value : '—';
