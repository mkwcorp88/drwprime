import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseDocument } from '../../prisma/import-ops-md';

describe('treatment ops MD import parser', () => {
  it('parses the shipped template correctly', () => {
    const text = readFileSync('prisma/import-ops-template.md', 'utf8');
    const { employees, treatments, errors } = parseDocument(text);

    expect(errors).toEqual([]);
    expect(employees).toHaveLength(3);
    expect(employees[0]).toMatchObject({
      email: 'budi.santoso@example.com',
      employeeId: 'TRP-002',
      role: 'THERAPIST',
      branchCode: 'DRW-UTAMA',
      password: null,
    });
    expect(employees[1].role).toBe('DOCTOR');
    expect(employees[2].role).toBe('FRONT_OFFICE');

    expect(treatments).toHaveLength(2);
    expect(treatments[0].code).toBe('FAC-BRIGHT');
    expect(treatments[0].steps).toHaveLength(6);
    expect(treatments[0].steps[0]).toMatchObject({
      actionName: 'Persiapan dan cleansing',
      isRequired: true,
      requiredRole: 'THERAPIST',
      incentiveValue: 3000,
    });
    expect(treatments[0].steps[1].isRequired).toBe(false);
    expect(treatments[1].code).toBe('KONSUL-FULL');
    expect(treatments[1].steps[0].requiredRole).toBe('DOCTOR');
  });

  it('reports invalid rows with errors', () => {
    const text = [
      '## Karyawan',
      '| Email | Nama | ID | Role | Cabang | Password |',
      '|---|---|---|---|---|---|',
      '| bukan-email | X | T-1 | Terapis | DRW-UTAMA | |',
      '| a@b.com | Y | T-2 | Terapis | DRW-UTAMA | |',
      '| c@d.com | Z | T-3 | RoleAneh | DRW-UTAMA | |',
      '## Treatment',
      '### Test (T-100)',
      'Kategori: X | Harga: 100',
      '| No | Tindakan | Wajib | Role | Menit | Insentif |',
      '|---|---|---|---|---|---|',
    ].join('\n');
    const { employees, treatments, errors } = parseDocument(text);
    expect(employees).toHaveLength(1); // only a@b.com with valid role
    expect(treatments).toHaveLength(1);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});
