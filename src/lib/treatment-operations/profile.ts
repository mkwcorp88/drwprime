import { normalizePhone } from '@/lib/phone';

export function normalizeOpsPhone(value: string): string {
  return normalizePhone(value.trim());
}

export function validateOpsPhone(value: string): string | null {
  const phone = normalizeOpsPhone(value);
  if (!/^62\d{8,13}$/.test(phone)) return 'Format nomor WhatsApp tidak valid.';
  return null;
}
