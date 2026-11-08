import { CrmError } from './auth';
import { CRM_PLATFORMS, CRM_ROLES, CRM_SOURCES, CRM_STATUSES } from './constants';

export function text(value: unknown, label: string, max: number, required = false): string {
  if (value !== undefined && value !== null && typeof value !== 'string') throw new CrmError(`${label} tidak valid.`);
  const result = (value || '').toString().trim();
  if ((required && !result) || result.length > max) throw new CrmError(`Isi ${label.toLowerCase()}${required ? '' : ' yang valid'} (maksimal ${max} karakter).`);
  return result;
}

export function phoneNumber(input: unknown): string {
  const value = text(input, 'Nomor WhatsApp', 40, true);
  if (!/^\+?[\d\s().-]+$/.test(value)) throw new CrmError('Nomor WhatsApp hanya boleh berisi angka dan tanda pemisah.');
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith('8')) digits = `62${digits}`;
  if (!/^\d{8,15}$/.test(digits)) throw new CrmError('Nomor WhatsApp harus berisi 8–15 angka.');
  return digits;
}

export function dateValue(value: unknown, label: string, required = false): Date | null {
  const input = text(value, label, 10, required);
  if (!input) return null;
  const date = new Date(`${input}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input) throw new CrmError(`${label} tidak valid.`);
  return date;
}

export function amountValue(value: unknown): number {
  const raw = typeof value === 'number' ? String(value) : text(value, 'Nominal', 12, true);
  if (!/^\d{1,12}$/.test(raw) || Number(raw) > 100_000_000_000) throw new CrmError('Nominal rupiah tidak valid.');
  return Number(raw);
}

export function option<T extends Record<string, string>>(value: unknown, choices: T, label: string): keyof T & string {
  if (typeof value !== 'string' || !Object.hasOwn(choices, value)) throw new CrmError(`${label} tidak valid.`);
  return value as keyof T & string;
}

export const sourceValue = (value: unknown) => option(value, CRM_SOURCES, 'Sumber');
export const statusValue = (value: unknown) => option(value, CRM_STATUSES, 'Status');
export const platformValue = (value: unknown) => option(value, CRM_PLATFORMS, 'Platform');
export const roleValue = (value: unknown) => option(value, CRM_ROLES, 'Peran');

export async function readCrmJson(request: Request, limit = 256_000): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new CrmError('Format permintaan tidak valid.', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new CrmError('Data belum lengkap.');
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new CrmError('Data terlalu besar.', 413); }
    chunks.push(value);
  }
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
    return value as Record<string, unknown>;
  } catch { throw new CrmError('Data tidak valid.'); }
}
