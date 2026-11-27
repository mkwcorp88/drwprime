import { describe, expect, it } from 'vitest';
import {
  createAffiliatorCrawlIndex,
  extractPhonesFromText,
  normalizePersonName,
  resolveAffiliatorPhone,
  type AffiliatorCrawlDataset,
  type AffiliatorMatchSubject,
} from '@/lib/affiliator-phone-matcher';

function emptyDataset(overrides: Partial<AffiliatorCrawlDataset> = {}): AffiliatorCrawlDataset {
  return {
    membersWithPhone: [],
    opsPatientsWithPhone: [],
    crmLeads: [],
    reservations: [],
    productOrders: [],
    staffAccounts: [],
    phoneRecoveries: [],
    preClaimCodes: [],
    ...overrides,
  };
}

function makeSubject(overrides: Partial<AffiliatorMatchSubject> = {}): AffiliatorMatchSubject {
  return {
    id: 'aff-1',
    clerkUserId: null,
    firstName: 'Siti',
    lastName: 'Aminah',
    email: 'siti.aminah@gmail.com',
    phone: null,
    loginPhone: null,
    affiliateCode: 'SA123',
    bankAccountNames: [],
    reservations: [],
    ...overrides,
  };
}

describe('normalizePersonName', () => {
  it('strips Indonesian clinic honorifics and academic credentials', () => {
    expect(normalizePersonName('Ny. Siti Aminah, S.Pd')).toBe('siti aminah');
    expect(normalizePersonName('Ibu Hj. Dewi Lestari')).toBe('dewi lestari');
    expect(normalizePersonName('  DRG.  Rina   Wahyuni ')).toBe('rina wahyuni');
  });
});

describe('extractPhonesFromText', () => {
  it('extracts and normalizes Indonesian phone numbers from free-text notes', () => {
    expect(extractPhonesFromText('Kontak WA: 0812-3456-7890 (aktif)')).toEqual(['6281234567890']);
    expect(extractPhonesFromText('HP +62 813 9988 7766 / 085711223344')).toEqual([
      '6281399887766',
      '6285711223344',
    ]);
  });
});

describe('resolveAffiliatorPhone', () => {
  it('prioritizes direct loginPhone and profile phone as verified without running fuzzy member matches', () => {
    const index = createAffiliatorCrawlIndex(
      emptyDataset({
        membersWithPhone: [
          {
            id: 'other-1',
            firstName: 'Siti Aminah',
            lastName: null,
            email: null,
            phone: '6289999999999',
            loginPhone: null,
            nomorRekamMedis: 'RM001',
          },
        ],
      })
    );

    const res = resolveAffiliatorPhone(
      makeSubject({ loginPhone: '6281111111111', phone: '081222222222' }),
      index
    );

    expect(res.phone).toBe('6281111111111');
    expect(res.confidence).toBe('verified');
    expect(res.source).toBe('login_phone');
    expect(res.candidates.map((c) => c.phone)).toEqual(['6281111111111', '6281222222222']);
  });

  it('matches phone from Reservation or ProductOrder by email and CrmLead by name', () => {
    const index = createAffiliatorCrawlIndex(
      emptyDataset({
        reservations: [
          {
            patientName: 'Siti Aminah',
            patientEmail: 'SITI.AMINAH@GMAIL.COM',
            patientPhone: '081234567890',
          },
        ],
        productOrders: [
          {
            customerName: 'Dewi Kartika',
            customerEmail: 'dewi.k@gmail.com',
            customerPhone: '+6281344556677',
          },
        ],
        crmLeads: [
          {
            id: 'lead-1',
            name: 'Ayu Larasati',
            phone: '085611223344',
            phoneNormalized: '6285611223344',
          },
        ],
      })
    );

    const r1 = resolveAffiliatorPhone(makeSubject(), index);
    expect(r1.phone).toBe('6281234567890');
    expect(r1.confidence).toBe('exact');
    expect(r1.source).toBe('reservation_email');

    const r2 = resolveAffiliatorPhone(
      makeSubject({ id: 'aff-2', firstName: 'Dewi', lastName: 'Kartika', email: 'dewi.k@gmail.com' }),
      index
    );
    expect(r2.phone).toBe('6281344556677');
    expect(r2.confidence).toBe('exact');
    expect(r2.source).toBe('product_order_email');

    const r3 = resolveAffiliatorPhone(
      makeSubject({ id: 'aff-3', firstName: 'Ayu', lastName: 'Larasati', email: 'ayu@gmail.com' }),
      index
    );
    expect(r3.phone).toBe('6285611223344');
    expect(r3.confidence).toBe('high');
    expect(r3.source).toBe('crm_lead_name_exact');
  });

  it('matches Google-registered affiliator with walk-in member having full name in firstName and honorific prefix', () => {
    const index = createAffiliatorCrawlIndex(
      emptyDataset({
        membersWithPhone: [
          {
            id: 'walkin-1',
            firstName: 'Ny. Rina Wahyuni',
            lastName: null,
            email: null,
            phone: '081298765432',
            loginPhone: null,
            nomorRekamMedis: 'RM-1042',
          },
        ],
      })
    );

    const res = resolveAffiliatorPhone(
      makeSubject({
        firstName: 'Rina',
        lastName: 'Wahyuni',
        email: 'rinawahyuni99@gmail.com',
      }),
      index
    );

    expect(res.phone).toBe('6281298765432');
    expect(res.confidence).toBe('high');
    expect(res.source).toBe('member_name_exact');
    expect(res.matchedMrNumber).toBe('RM-1042');
  });

  it('matches using BankAccount.accountName when Google display name is a nickname', () => {
    const index = createAffiliatorCrawlIndex(
      emptyDataset({
        membersWithPhone: [
          {
            id: 'walkin-2',
            firstName: 'Nisa Rahmawati',
            lastName: null,
            email: null,
            phone: '6287712345678',
            loginPhone: null,
            nomorRekamMedis: 'RM-2088',
          },
        ],
      })
    );

    const res = resolveAffiliatorPhone(
      makeSubject({
        firstName: 'Mama',
        lastName: 'Abi',
        email: 'abi.store@gmail.com',
        bankAccountNames: ['Nisa Rahmawati'],
      }),
      index
    );

    expect(res.phone).toBe('6287712345678');
    expect(res.confidence).toBe('high');
    expect(res.source).toBe('bank_account_name_exact');
    expect(res.matchedMemberName).toBe('Nisa Rahmawati');
  });

  it('flags ambiguous multiple exact-name matches as candidate', () => {
    const index = createAffiliatorCrawlIndex(
      emptyDataset({
        membersWithPhone: [
          {
            id: 'm-1',
            firstName: 'Dewi Sartika',
            lastName: null,
            email: null,
            phone: '628111111111',
            loginPhone: null,
            nomorRekamMedis: 'RM-01',
          },
          {
            id: 'm-2',
            firstName: 'Dewi Sartika',
            lastName: null,
            email: null,
            phone: '628222222222',
            loginPhone: null,
            nomorRekamMedis: 'RM-02',
          },
        ],
      })
    );

    const ambiguous = resolveAffiliatorPhone(
      makeSubject({
        firstName: 'Dewi',
        lastName: 'Sartika',
        email: 'beautyshop88@gmail.com',
      }),
      index
    );

    expect(ambiguous.confidence).toBe('candidate');
    expect(ambiguous.candidates).toHaveLength(2);
  });

  it('matches via email prefix when profile name is a generic shop name', () => {
    const index = createAffiliatorCrawlIndex(
      emptyDataset({
        membersWithPhone: [
          {
            id: 'walkin-3',
            firstName: 'Putri',
            lastName: 'Handayani',
            email: null,
            phone: '085233445566',
            loginPhone: null,
            nomorRekamMedis: 'RM-3300',
          },
        ],
      })
    );

    const res = resolveAffiliatorPhone(
      makeSubject({
        firstName: 'Skincare',
        lastName: 'Official',
        email: 'putrihandayani95@gmail.com',
      }),
      index
    );

    expect(res.phone).toBe('6285233445566');
    expect(res.confidence).toBe('candidate');
    expect(res.source).toBe('email_prefix_name');
  });

  it('matches fuzzy spelling typo and OpsPatient fallback', () => {
    const index = createAffiliatorCrawlIndex(
      emptyDataset({
        opsPatientsWithPhone: [
          {
            id: 'ops-1',
            name: 'Fitria Wulandari',
            phone: '081900112233',
            mrNumber: 'OPS-99',
          },
        ],
      })
    );

    const res = resolveAffiliatorPhone(
      makeSubject({
        firstName: 'Fitri',
        lastName: 'Wulandari',
        email: 'fw_glow@gmail.com',
      }),
      index
    );

    expect(res.phone).toBe('6281900112233');
    expect(res.confidence).toBe('candidate');
    expect(res.source).toBe('ops_patient_name_fuzzy');
  });

  it('treats reservation owned by user with completely different patient name as candidate rather than exact', () => {
    const index = createAffiliatorCrawlIndex(emptyDataset());
    const res = resolveAffiliatorPhone(
      makeSubject({
        firstName: 'Budi',
        lastName: 'Santoso',
        email: 'budi@gmail.com',
        reservations: [
          {
            patientName: 'Larasati Kusuma',
            patientEmail: 'laras@gmail.com',
            patientPhone: '081234000999',
          },
        ],
      }),
      index
    );

    expect(res.phone).toBe('6281234000999');
    expect(res.confidence).toBe('candidate');
    expect(res.source).toBe('reservation_user');
  });

  it('extracts phone from PreClaimAffiliateCode notes and ignores generic placeholder names', () => {
    const index = createAffiliatorCrawlIndex(
      emptyDataset({
        preClaimCodes: [
          {
            code: 'DRW99',
            assignedEmail: null,
            notes: 'Titipan ibu Rina WA 0812-8877-6655',
          },
        ],
        membersWithPhone: [
          {
            id: 'walkin-gen',
            firstName: 'Member',
            lastName: null,
            email: null,
            phone: '081200001111',
            loginPhone: null,
            nomorRekamMedis: null,
          },
        ],
      })
    );

    const noteMatch = resolveAffiliatorPhone(
      makeSubject({
        firstName: 'Member',
        lastName: null,
        email: 'rina.aff@gmail.com',
        affiliateCode: 'DRW99',
      }),
      index
    );
    expect(noteMatch.phone).toBe('6281288776655');
    expect(noteMatch.source).toBe('preclaim_notes');

    const noMatch = resolveAffiliatorPhone(
      makeSubject({
        firstName: 'Member',
        lastName: null,
        email: 'admin@gmail.com',
        affiliateCode: 'OTHER1',
      }),
      index
    );
    expect(noMatch.phone).toBeNull();
    expect(noMatch.confidence).toBe('none');
  });
});
