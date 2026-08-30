import type { OpsManualPatientReason } from '@prisma/client';
import { normalizeAidoPhone } from '@/lib/aido/mapping';
import { MANUAL_PATIENT_REASON_CODES } from './constants';
import { OpsError } from './utils';

export type ManualPatientInput = {
  name: string;
  phone: string | null;
  manualEntryReason: OpsManualPatientReason | null;
  manualEntryNote: string | null;
};

export function parseManualPatientInput(body: Record<string, unknown>): ManualPatientInput {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 2 || name.length > 120) throw new OpsError(422, 'Nama pasien harus 2 sampai 120 karakter.');

  const phoneInput = typeof body.phone === 'string' ? body.phone.trim() : '';
  const phone = phoneInput ? normalizeAidoPhone(phoneInput) : null;
  if (phoneInput && !phone) throw new OpsError(422, 'Format nomor WhatsApp pasien tidak valid.');

  const reasonInput = typeof body.manualEntryReason === 'string' ? body.manualEntryReason.trim() : '';
  let manualEntryReason: OpsManualPatientReason | null = null;
  if (reasonInput) {
    if (!(MANUAL_PATIENT_REASON_CODES as readonly string[]).includes(reasonInput)) {
      throw new OpsError(422, 'Alasan input manual tidak valid.');
    }
    manualEntryReason = reasonInput as OpsManualPatientReason;
  }

  const manualEntryNote = typeof body.manualEntryNote === 'string' ? body.manualEntryNote.trim() : '';
  if (manualEntryNote.length > 240) throw new OpsError(422, 'Catatan alasan maksimal 240 karakter.');

  return {
    name,
    phone,
    manualEntryReason,
    manualEntryNote: manualEntryNote || null,
  };
}
