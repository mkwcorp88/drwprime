import { describe, expect, it } from 'vitest';
import { MANUAL_PATIENT_ENTRY_ROLES } from '@/lib/treatment-operations/constants';
import { parseManualPatientInput } from '@/lib/treatment-operations/patients';
import { OpsError } from '@/lib/treatment-operations/utils';

describe('manual patient input', () => {
  it('allows the approved roles and normalizes the optional phone number', () => {
    expect(MANUAL_PATIENT_ENTRY_ROLES).toEqual(['SUPER_ADMIN', 'MANAGEMENT', 'SUPERVISOR']);
    expect(parseManualPatientInput({
      name: '  Sari Utami ',
      phone: '0812-3456-7890',
      manualEntryReason: 'AIDO_UNAVAILABLE',
    })).toEqual({
      name: 'Sari Utami',
      phone: '6281234567890',
      manualEntryReason: 'AIDO_UNAVAILABLE',
      manualEntryNote: null,
    });
  });

  it('requires a note when the reason is other', () => {
    expect(() => parseManualPatientInput({
      name: 'Sari Utami',
      manualEntryReason: 'OTHER',
    })).toThrow('Catatan wajib diisi');
  });

  it('rejects invalid phone numbers and unknown reasons', () => {
    for (const input of [
      { name: 'Sari Utami', phone: '12345', manualEntryReason: 'AIDO_UNAVAILABLE' },
      { name: 'Sari Utami', manualEntryReason: 'UNSAFE_REASON' },
    ]) {
      try {
        parseManualPatientInput(input);
        throw new Error('Expected validation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(OpsError);
        expect((error as OpsError).status).toBe(422);
      }
    }
  });
});
