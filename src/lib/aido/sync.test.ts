import { describe, expect, it } from 'vitest';
import { AidoIncome } from '@/lib/aido/mapping';
import { AidoMatchIndex, matchIncomeUser } from '@/lib/aido/sync';

const income: AidoIncome = {
  externalId: 'trx-1',
  externalPatientId: 'patient-1',
  externalPatientNumericId: null,
  mrNumber: 'MR-1',
  registrationNumber: null,
  receiptNumber: null,
  patientName: 'Same Name',
  transactionDate: new Date('2026-08-19T03:00:00.000Z'),
  amount: 100_000,
  treatment: null,
};

function createIndex(): AidoMatchIndex {
  return {
    byExternalId: new Map(),
    byNumericId: new Map(),
    byMrNumber: new Map(),
  };
}

describe('AIDO income identity matching', () => {
  it('requires all supplied stable identifiers to resolve to one user', () => {
    const index = createIndex();
    index.byExternalId.set('patient-1', 'user-1');
    index.byMrNumber.set('MR-1', 'user-1');
    expect(matchIncomeUser(income, index)).toBe('user-1');
  });

  it('rejects conflicting stable identifiers', () => {
    const index = createIndex();
    index.byExternalId.set('patient-1', 'user-1');
    index.byMrNumber.set('MR-1', 'user-2');
    expect(matchIncomeUser(income, index)).toBeNull();
  });

  it('rejects a missing stable identifier even when another one matches', () => {
    const index = createIndex();
    index.byExternalId.set('patient-1', 'user-1');
    expect(matchIncomeUser(income, index)).toBeNull();
  });

  it('never falls back to a patient name', () => {
    const index = createIndex();
    expect(matchIncomeUser({
      ...income,
      externalPatientId: null,
      mrNumber: null,
    }, index)).toBeNull();
  });
});
