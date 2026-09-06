import type { OpsDayOffStatus, OpsStaffDayOff } from '@prisma/client';
import { OpsError } from './utils';
import { dateKeyFromDate, dateKeyToDate } from './date';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const DAY_OFF_MANAGEMENT_ROLES = ['SUPER_ADMIN', 'MANAGEMENT'] as const;

export type OpsDayOffRow = Pick<
  OpsStaffDayOff,
  'id' | 'staffId' | 'date' | 'note' | 'createdAt' | 'status' | 'approvedAt'
> & { approvedBy?: { id: string; name: string } | null };

export function parseOpsDateOnly(value: unknown): string {
  const date = typeof value === 'string' ? value.trim() : '';
  if (!DATE_ONLY_PATTERN.test(date) || dateKeyFromDate(dateKeyToDate(date)) !== date) {
    throw new OpsError(422, 'Tanggal libur tidak valid.');
  }
  return date;
}

export function serializeDayOff(dayOff: OpsDayOffRow) {
  return {
    id: dayOff.id,
    staffId: dayOff.staffId,
    date: dateKeyFromDate(dayOff.date),
    note: dayOff.note,
    createdAt: dayOff.createdAt,
    status: dayOff.status as OpsDayOffStatus,
    approvedAt: dayOff.approvedAt ?? null,
    approvedBy: dayOff.approvedBy ? { id: dayOff.approvedBy.id, name: dayOff.approvedBy.name } : null,
  };
}
