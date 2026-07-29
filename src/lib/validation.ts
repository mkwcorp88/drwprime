/**
 * Shared validation helpers — used by API routes and service layer.
 */
import { normalizePhone } from '@/lib/phone';

export interface ValidationErrors {
  [field: string]: string;
}

export function validatePhone(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return 'Nomor HP wajib diisi';
  }
  const phone = normalizePhone(value.trim());
  if (!/^[0-9]{8,13}$/.test(phone)) {
    return 'Format nomor HP tidak valid';
  }
  return null;
}

export function validateNik(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return 'NIK wajib diisi';
  }
  if (!/^[0-9]{16}$/.test(value.trim())) {
    return 'NIK harus 16 digit angka';
  }
  return null;
}

export function validateRequired(value: unknown, label: string): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return `${label} wajib diisi`;
  }
  return null;
}

export function validateDate(value: unknown, label: string): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return `${label} wajib diisi`;
  }
  const date = new Date(value.trim());
  if (Number.isNaN(date.getTime())) {
    return `${label} tidak valid`;
  }
  return null;
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function toValidationResponse(errors: ValidationErrors) {
  return {
    error: 'Validasi gagal',
    fields: errors,
    status: 400 as const,
  };
}
