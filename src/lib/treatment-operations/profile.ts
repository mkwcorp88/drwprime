import { normalizePhone } from '@/lib/phone';
import { normalizeOpsEmail, validateOpsEmail } from './password';

export function normalizeOpsPhone(value: string): string {
  return normalizePhone(value.trim());
}

export function validateOpsPhone(value: string): string | null {
  const phone = normalizeOpsPhone(value);
  if (!/^62\d{8,13}$/.test(phone)) return 'Format nomor WhatsApp tidak valid.';
  return null;
}

export type OpsLoginIdentifier =
  | { type: 'phone'; value: string }
  | { type: 'legacy-email'; value: string };

// Email is accepted only as a migration bridge for staff without a phone number.
export function resolveOpsLoginIdentifier(value: string): OpsLoginIdentifier | null {
  const phone = normalizeOpsPhone(value);
  if (!validateOpsPhone(phone)) return { type: 'phone', value: phone };

  const email = normalizeOpsEmail(value);
  if (!validateOpsEmail(email)) return { type: 'legacy-email', value: email };

  return null;
}
