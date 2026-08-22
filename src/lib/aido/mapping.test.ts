import { describe, expect, it } from 'vitest';
import {
  getJakartaDateRange,
  getPreviousJakartaDate,
  mapAidoIncome,
  mapAidoPatient,
  normalizeAidoName,
  normalizeAidoPhone,
} from '@/lib/aido/mapping';

describe('AIDO patient mapping', () => {
  it('maps stable identity and normalizes an Indonesian WhatsApp number', () => {
    const patient = mapAidoPatient({
      uuid: 'patient-uuid',
      id: 123,
      firstName: 'Sari',
      lastName: 'Utami',
      waNumber: '0812-3456-7890',
      mrNumber: 'RM-001',
      nik: '3374010203900001',
      dob: '1990-05-02',
      gender: 'P',
    });

    expect(patient).toMatchObject({
      externalPatientId: 'patient-uuid',
      externalPatientNumericId: '123',
      firstName: 'Sari',
      lastName: 'Utami',
      phone: '6281234567890',
      mrNumber: 'RM-001',
      nik: '3374010203900001',
      gender: 'Wanita',
    });
    expect(patient?.dateOfBirth?.toISOString()).toBe('1990-05-02T00:00:00.000Z');
  });

  it('rejects rows without a stable patient identity', () => {
    expect(mapAidoPatient({ firstName: 'Sari' })).toBeNull();
  });
});

describe('AIDO income mapping', () => {
  it('maps the field names returned by the income report', () => {
    const income = mapAidoIncome({
      id: 'income-row-001',
      trxnumber: 'TRX-001',
      registrationnumber: 'REG-001',
      nomorkwitansi: 'KW-001',
      firstnamedecoded: 'Sari Utami',
      paymentdate: '2026-08-19 14:30:00',
      totalbill: '1.250.000',
      visitname: 'Facial',
      medicalcategoriesname: 'OPD',
      patientUuid: 'patient-uuid',
    });

    expect(income).toMatchObject({
      externalId: 'TRX-001',
      externalPatientId: 'patient-uuid',
      registrationNumber: 'REG-001',
      receiptNumber: 'KW-001',
      patientName: 'Sari Utami',
      amount: 1_250_000,
      treatment: 'Facial - OPD',
    });
    expect(income?.transactionDate.toISOString()).toBe('2026-08-19T07:30:00.000Z');
  });

  it('rejects rows missing a transaction date or amount', () => {
    expect(mapAidoIncome({ trxnumber: 'TRX-001' })).toBeNull();
  });

  it('requires a stable source transaction identifier', () => {
    expect(mapAidoIncome({
      registrationnumber: 'REG-001',
      nomorkwitansi: 'KW-001',
      paymentdate: '2026-08-19 14:30:00',
      totalbill: 100_000,
    })).toBeNull();
  });

  it('rejects impossible calendar dates', () => {
    expect(mapAidoIncome({
      trxnumber: 'TRX-001',
      paymentdate: '2026-02-30 14:30:00',
      totalbill: 100_000,
    })).toBeNull();
  });

  it('rejects negative income until refund semantics are configured', () => {
    expect(mapAidoIncome({
      trxnumber: 'TRX-001',
      paymentdate: '2026-08-19 14:30:00',
      totalbill: -100_000,
    })).toBeNull();
  });
});

describe('AIDO normalization and schedule dates', () => {
  it('normalizes names without fuzzy matching', () => {
    expect(normalizeAidoName('  Sari   Utami ')).toBe('sari utami');
  });

  it('rejects invalid WhatsApp numbers', () => {
    expect(normalizeAidoPhone('12345')).toBeNull();
  });

  it('uses the previous calendar day in Jakarta', () => {
    expect(getPreviousJakartaDate(new Date('2026-08-20T19:00:00Z'))).toBe('2026-08-20');
  });

  it('creates a Jakarta day range', () => {
    const range = getJakartaDateRange('2026-08-20');
    expect(range.start.toISOString()).toBe('2026-08-19T17:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-08-20T17:00:00.000Z');
  });
});
