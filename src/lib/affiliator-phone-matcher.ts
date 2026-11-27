import { formatPhone, normalizePhone } from '@/lib/phone';

export type PhoneMatchConfidence =
  | 'verified'
  | 'exact'
  | 'high'
  | 'candidate'
  | 'none';

export type PhoneMatchSource =
  | 'login_phone'
  | 'user_profile'
  | 'staff_account'
  | 'phone_recovery'
  | 'member_email_exact'
  | 'reservation_email'
  | 'reservation_user'
  | 'product_order_email'
  | 'preclaim_notes'
  | 'member_name_exact'
  | 'bank_account_name_exact'
  | 'ops_patient_name_exact'
  | 'crm_lead_name_exact'
  | 'member_name_fuzzy'
  | 'bank_account_name_fuzzy'
  | 'ops_patient_name_fuzzy'
  | 'crm_lead_name_fuzzy'
  | 'email_prefix_name'
  | 'none';

export interface PhoneMatchCandidate {
  phone: string;
  displayPhone: string;
  confidence: Exclude<PhoneMatchConfidence, 'none'>;
  source: PhoneMatchSource;
  sourceLabel: string;
  matchedName: string;
  matchedUserId?: string;
  matchedMrNumber?: string | null;
  score: number;
  reason: string;
}

export interface AffiliatorPhoneResolution {
  phone: string | null;
  displayPhone: string | null;
  confidence: PhoneMatchConfidence;
  source: PhoneMatchSource;
  sourceLabel: string;
  reason: string;
  matchedMemberName: string | null;
  matchedMrNumber: string | null;
  candidates: PhoneMatchCandidate[];
}

export interface AffiliatorMatchSubject {
  id: string;
  clerkUserId?: string | null;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  loginPhone: string | null;
  affiliateCode: string | null;
  bankAccountNames: string[];
  reservations: Array<{
    patientName: string;
    patientEmail: string;
    patientPhone: string;
    createdAt?: Date | string;
  }>;
}

export interface MemberPhoneRecord {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  loginPhone: string | null;
  nomorRekamMedis: string | null;
}

export interface OpsPatientPhoneRecord {
  id: string;
  name: string;
  phone: string | null;
  mrNumber: string | null;
}

export interface CrmLeadPhoneRecord {
  id: string;
  name: string;
  phone: string;
  phoneNormalized: string;
}

export interface EmailPhoneRecord {
  email: string | null;
  phone: string | null;
  name: string;
}

export interface StaffPhoneRecord {
  email: string | null;
  legacyClerkId: string | null;
  phone: string | null;
  name: string;
}

export interface RecoveryPhoneRecord {
  userId: string;
  phone: string;
}

export interface PreClaimPhoneRecord {
  code: string;
  assignedEmail: string | null;
  notes: string | null;
}

export interface AffiliatorCrawlDataset {
  membersWithPhone: MemberPhoneRecord[];
  opsPatientsWithPhone: OpsPatientPhoneRecord[];
  crmLeads: CrmLeadPhoneRecord[];
  reservations: Array<{
    patientName: string;
    patientEmail: string;
    patientPhone: string;
  }>;
  productOrders: Array<{
    customerName: string;
    customerEmail: string | null;
    customerPhone: string;
  }>;
  staffAccounts: StaffPhoneRecord[];
  phoneRecoveries: RecoveryPhoneRecord[];
  preClaimCodes: PreClaimPhoneRecord[];
}

const GENERIC_NAMES = new Set([
  'member',
  'walk in',
  'walkin',
  'guest',
  'user',
  'customer',
  'admin',
  'test',
  'pasien',
  'tanpa nama',
  'unknown',
  'null',
  'na',
]);

const GENERIC_EMAIL_TOKENS = new Set([
  'admin',
  'info',
  'cs',
  'drw',
  'drwprime',
  'prime',
  'beauty',
  'skincare',
  'official',
  'shop',
  'store',
  'affiliate',
  'afiliasi',
  'user',
  'member',
  'gmail',
  'yahoo',
  'ymail',
  'hotmail',
  'outlook',
  'email',
  'mail',
  'akun',
  'account',
  'klinik',
  'clinic',
  'estetika',
  'hello',
  'contact',
  'team',
]);

const DOTTED_HONORIFIC_RE = /^(?:ny|nn|tn|sdr|sdri|an|ibu|bpk|bapak|hj|dr|drg|prof)\.\s+/;
const WORD_HONORIFIC_RE = /^(?:ny|nn|tn|sdr|sdri|ibu|bpk|bapak|hj|dr|drg|prof)\s+/;
const CREDENTIAL_SUFFIX_RE = /,\s*(?:s\.?[a-z]{1,5}|m\.?[a-z]{1,5}|a\.?md|dr|drg|se|sh|st|sp\.?[a-z]+)\.?$/i;
const PHONE_TEXT_RE = /(?:\+?62|0)\s*8[\d\s().-]{7,14}\d/g;

/** Normalize a phone string to Indonesian `62...` format if valid, otherwise null. */
export function normalizeIndoPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = normalizePhone(trimmed);
  if (!/^62\d{8,13}$/.test(normalized)) return null;
  if (/^62(\d)\1{7,}$/.test(normalized)) return null;
  return normalized;
}

/** Normalize an email address for exact case-insensitive comparison. */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.includes('@') ? trimmed : null;
}

/** Normalize a person or account holder name for matching across tables. */
export function normalizePersonName(raw: string | null | undefined): string {
  if (!raw) return '';
  let text = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('id-ID')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return '';

  text = text.replace(CREDENTIAL_SUFFIX_RE, '').trim();

  for (let i = 0; i < 2; i++) {
    const dotted = text.replace(DOTTED_HONORIFIC_RE, '').trim();
    if (dotted !== text && dotted.length >= 3) {
      text = dotted;
      continue;
    }
    const worded = text.replace(WORD_HONORIFIC_RE, '').trim();
    if (worded !== text && worded.includes(' ') && worded.length >= 3) {
      text = worded;
      continue;
    }
    break;
  }

  return text
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isMeaningfulName(normalizedName: string): boolean {
  if (!normalizedName || normalizedName.length < 3) return false;
  if (/^\d+$/.test(normalizedName.replace(/\s+/g, ''))) return false;
  return !GENERIC_NAMES.has(normalizedName);
}

function tokenizeName(normalizedName: string): string[] {
  return normalizedName.split(' ').filter((token) => token.length >= 2);
}

function fullNameFromParts(firstName: string | null | undefined, lastName: string | null | undefined): string {
  return [firstName, lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
}

function extractEmailNameCandidate(email: string | null | undefined): {
  spaced: string;
  compact: string;
  tokens: string[];
} | null {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const localRaw = normalized.split('@')[0].split('+')[0];
  const tokens = localRaw
    .split(/[._-]+/)
    .map((part) => part.replace(/\d+/g, '').toLowerCase())
    .filter((part) => part.length >= 2 && !GENERIC_EMAIL_TOKENS.has(part));

  const compact = localRaw.replace(/[^a-z]/g, '').toLowerCase();
  if (tokens.length === 0 && compact.length < 7) return null;
  return {
    spaced: tokens.join(' '),
    compact,
    tokens,
  };
}

/** Extract Indonesian phone numbers embedded inside free-text admin notes. */
export function extractPhonesFromText(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.match(PHONE_TEXT_RE) ?? [];
  const phones: string[] = [];
  for (const match of matches) {
    const normalized = normalizeIndoPhone(match);
    if (normalized && !phones.includes(normalized)) {
      phones.push(normalized);
    }
  }
  return phones;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, idx) => idx);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

function stringSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function namesCompatible(leftRaw: string, rightRaw: string): boolean {
  const left = normalizePersonName(leftRaw);
  const right = normalizePersonName(rightRaw);
  if (!isMeaningfulName(left) || !isMeaningfulName(right)) return false;
  if (left === right) return true;

  const leftTokens = tokenizeName(left);
  const rightTokens = tokenizeName(right);
  const overlap = leftTokens.filter((token) => rightTokens.includes(token));
  if (overlap.length >= 1 && (leftTokens.length === 1 || rightTokens.length === 1 || overlap.length >= 2)) {
    return true;
  }
  return Math.min(left.length, right.length) >= 6 && stringSimilarity(left, right) >= 0.8;
}

type DirectoryKind = 'member' | 'ops_patient' | 'crm_lead';

type IndexedDirectoryEntry = {
  kind: DirectoryKind;
  userId?: string;
  displayName: string;
  normalizedName: string;
  compactName: string;
  tokens: string[];
  sortedTokensKey: string;
  phone: string;
  email: string | null;
  mrNumber: string | null;
};

type SearchIndexes = {
  byEmail: Map<string, IndexedDirectoryEntry[]>;
  byExactName: Map<string, IndexedDirectoryEntry[]>;
  bySortedTokens: Map<string, IndexedDirectoryEntry[]>;
  byCompactName: Map<string, IndexedDirectoryEntry[]>;
  byToken: Map<string, IndexedDirectoryEntry[]>;
  byReservationEmail: Map<string, EmailPhoneRecord[]>;
  byOrderEmail: Map<string, EmailPhoneRecord[]>;
  byStaffEmail: Map<string, StaffPhoneRecord[]>;
  byStaffLegacyId: Map<string, StaffPhoneRecord>;
  byRecoveryUserId: Map<string, string[]>;
  byPreClaimCode: Map<string, PreClaimPhoneRecord>;
};

function pushToMap<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function buildDirectoryEntry(
  kind: DirectoryKind,
  displayName: string,
  phone: string,
  email: string | null,
  mrNumber: string | null,
  userId?: string
): IndexedDirectoryEntry | null {
  const normalizedName = normalizePersonName(displayName);
  if (!isMeaningfulName(normalizedName)) return null;
  const tokens = tokenizeName(normalizedName);
  const compactName = normalizedName.replace(/\s+/g, '');
  const sortedTokensKey = [...tokens].sort().join(' ');
  return {
    kind,
    userId,
    displayName: displayName.trim() || normalizedName,
    normalizedName,
    compactName,
    tokens,
    sortedTokensKey,
    phone,
    email: normalizeEmail(email),
    mrNumber,
  };
}

/** Build fast O(1)/bucketed lookup indexes once per crawl run. */
export function createAffiliatorCrawlIndex(dataset: AffiliatorCrawlDataset): SearchIndexes {
  const byEmail = new Map<string, IndexedDirectoryEntry[]>();
  const byExactName = new Map<string, IndexedDirectoryEntry[]>();
  const bySortedTokens = new Map<string, IndexedDirectoryEntry[]>();
  const byCompactName = new Map<string, IndexedDirectoryEntry[]>();
  const byToken = new Map<string, IndexedDirectoryEntry[]>();

  const registerEntry = (entry: IndexedDirectoryEntry | null) => {
    if (!entry) return;
    if (entry.email) pushToMap(byEmail, entry.email, entry);
    pushToMap(byExactName, entry.normalizedName, entry);
    if (entry.tokens.length >= 2) {
      pushToMap(bySortedTokens, entry.sortedTokensKey, entry);
    }
    if (entry.compactName.length >= 6) {
      pushToMap(byCompactName, entry.compactName, entry);
    }
    const seenTokens = new Set<string>();
    for (const token of entry.tokens) {
      if (token.length < 3 || seenTokens.has(token)) continue;
      seenTokens.add(token);
      pushToMap(byToken, token, entry);
    }
  };

  for (const member of dataset.membersWithPhone) {
    const phone = normalizeIndoPhone(member.loginPhone) ?? normalizeIndoPhone(member.phone);
    if (!phone) continue;
    const displayName = fullNameFromParts(member.firstName, member.lastName);
    const entry = buildDirectoryEntry('member', displayName, phone, member.email, member.nomorRekamMedis, member.id);
    if (entry) {
      registerEntry(entry);
    } else if (member.email) {
      const emailNorm = normalizeEmail(member.email);
      if (emailNorm) {
        pushToMap(byEmail, emailNorm, {
          kind: 'member',
          userId: member.id,
          displayName: displayName || member.email,
          normalizedName: '',
          compactName: '',
          tokens: [],
          sortedTokensKey: '',
          phone,
          email: emailNorm,
          mrNumber: member.nomorRekamMedis,
        });
      }
    }
  }

  for (const patient of dataset.opsPatientsWithPhone) {
    const phone = normalizeIndoPhone(patient.phone);
    if (!phone) continue;
    registerEntry(buildDirectoryEntry('ops_patient', patient.name, phone, null, patient.mrNumber));
  }

  for (const lead of dataset.crmLeads) {
    const phone = normalizeIndoPhone(lead.phoneNormalized) ?? normalizeIndoPhone(lead.phone);
    if (!phone) continue;
    registerEntry(buildDirectoryEntry('crm_lead', lead.name, phone, null, null));
  }

  const byReservationEmail = new Map<string, EmailPhoneRecord[]>();
  for (const r of dataset.reservations) {
    const email = normalizeEmail(r.patientEmail);
    if (email) pushToMap(byReservationEmail, email, { email, phone: r.patientPhone, name: r.patientName });
  }

  const byOrderEmail = new Map<string, EmailPhoneRecord[]>();
  for (const o of dataset.productOrders) {
    const email = normalizeEmail(o.customerEmail);
    if (email) pushToMap(byOrderEmail, email, { email, phone: o.customerPhone, name: o.customerName });
  }

  const byStaffEmail = new Map<string, StaffPhoneRecord[]>();
  const byStaffLegacyId = new Map<string, StaffPhoneRecord>();
  for (const staff of dataset.staffAccounts) {
    const email = normalizeEmail(staff.email);
    if (email) pushToMap(byStaffEmail, email, staff);
    if (staff.legacyClerkId) byStaffLegacyId.set(staff.legacyClerkId, staff);
  }

  const byRecoveryUserId = new Map<string, string[]>();
  for (const rec of dataset.phoneRecoveries) {
    const phone = normalizeIndoPhone(rec.phone);
    if (phone) pushToMap(byRecoveryUserId, rec.userId, phone);
  }

  const byPreClaimCode = new Map<string, PreClaimPhoneRecord>();
  for (const code of dataset.preClaimCodes) {
    byPreClaimCode.set(code.code.toUpperCase(), code);
  }

  return {
    byEmail,
    byExactName,
    bySortedTokens,
    byCompactName,
    byToken,
    byReservationEmail,
    byOrderEmail,
    byStaffEmail,
    byStaffLegacyId,
    byRecoveryUserId,
    byPreClaimCode,
  };
}

function addCandidate(map: Map<string, PhoneMatchCandidate>, candidate: Omit<PhoneMatchCandidate, 'displayPhone'>): void {
  const full: PhoneMatchCandidate = {
    ...candidate,
    displayPhone: formatPhone(candidate.phone),
  };
  const existing = map.get(full.phone);
  if (!existing || full.score > existing.score) {
    map.set(full.phone, full);
  }
}

function collectNameQueries(subject: AffiliatorMatchSubject): Array<{
  rawName: string;
  normalized: string;
  tokens: string[];
  origin: 'profile' | 'bank';
}> {
  const results: Array<{
    rawName: string;
    normalized: string;
    tokens: string[];
    origin: 'profile' | 'bank';
  }> = [];
  const seenNormalized = new Set<string>();

  const profileRaw = fullNameFromParts(subject.firstName, subject.lastName);
  const profileNorm = normalizePersonName(profileRaw);
  if (isMeaningfulName(profileNorm)) {
    seenNormalized.add(profileNorm);
    results.push({
      rawName: profileRaw,
      normalized: profileNorm,
      tokens: tokenizeName(profileNorm),
      origin: 'profile',
    });
  }

  for (const bankName of subject.bankAccountNames) {
    const bankNorm = normalizePersonName(bankName);
    if (!isMeaningfulName(bankNorm) || seenNormalized.has(bankNorm)) continue;
    seenNormalized.add(bankNorm);
    results.push({
      rawName: bankName,
      normalized: bankNorm,
      tokens: tokenizeName(bankNorm),
      origin: 'bank',
    });
  }

  return results;
}

function matchEmailBackedRecords(
  records: EmailPhoneRecord[],
  subjectNames: string[],
  source: 'reservation_email' | 'product_order_email',
  baseLabel: string,
  candidates: Map<string, PhoneMatchCandidate>
): void {
  for (const record of records) {
    const phone = normalizeIndoPhone(record.phone);
    if (!phone) continue;
    const nameMatches = subjectNames.some((name) => namesCompatible(name, record.name));
    addCandidate(candidates, {
      phone,
      confidence: 'exact',
      source,
      sourceLabel: nameMatches ? `${baseLabel} (Email & Nama)` : `${baseLabel} (Email)`,
      matchedName: record.name,
      score: nameMatches ? 94 : 90,
      reason: nameMatches
        ? `Email dan nama "${record.name}" cocok di data ${baseLabel.toLowerCase()}`
        : `Email sama dengan pendaftar di ${baseLabel.toLowerCase()} (${record.name})`,
    });
  }
}

function emailTokensMatchEntry(
  emailCandidate: ReturnType<typeof extractEmailNameCandidate>,
  entry: IndexedDirectoryEntry
): boolean {
  if (!emailCandidate) return false;
  if (emailCandidate.compact.length >= 7 && entry.compactName.includes(emailCandidate.compact)) {
    return true;
  }
  const matchedEmailTokens = emailCandidate.tokens.filter((t) =>
    entry.tokens.some((et) => et === t || (t.length >= 4 && et.startsWith(t)))
  );
  return matchedEmailTokens.length >= 2;
}

function exactDirectoryMeta(
  kind: DirectoryKind,
  origin: 'profile' | 'bank',
  isHigh: boolean
): {
  source: PhoneMatchSource;
  baseScore: number;
  label: string;
  entityNoun: string;
} {
  if (origin === 'bank') {
    const suffix = kind === 'crm_lead' ? 'CRM Lead' : kind === 'ops_patient' ? 'Pasien Ops' : 'Member';
    return {
      source: 'bank_account_name_exact',
      baseScore: kind === 'member' ? 85 : 82,
      label: isHigh ? `Nama Rekening -> ${suffix}` : `Nama Rekening -> ${suffix} (Multi)`,
      entityNoun: suffix.toLowerCase(),
    };
  }
  if (kind === 'ops_patient') {
    return {
      source: 'ops_patient_name_exact',
      baseScore: 81,
      label: isHigh ? 'Pasien Ops (Nama Persis)' : 'Pasien Ops (Nama Multi)',
      entityNoun: 'pasien ops',
    };
  }
  if (kind === 'crm_lead') {
    return {
      source: 'crm_lead_name_exact',
      baseScore: 80,
      label: isHigh ? 'CRM Lead (Nama Persis)' : 'CRM Lead (Nama Multi)',
      entityNoun: 'lead CRM',
    };
  }
  return {
    source: 'member_name_exact',
    baseScore: 84,
    label: isHigh ? 'Member (Nama Persis)' : 'Member (Nama Persis · Multi)',
    entityNoun: 'member',
  };
}

function fuzzyDirectoryMeta(
  kind: DirectoryKind,
  origin: 'profile' | 'bank'
): { source: PhoneMatchSource; label: string } {
  if (origin === 'bank') {
    return {
      source: 'bank_account_name_fuzzy',
      label: kind === 'crm_lead' ? 'Nama Rekening -> Lead CRM' : 'Nama Rekening -> Kandidat',
    };
  }
  if (kind === 'ops_patient') {
    return { source: 'ops_patient_name_fuzzy', label: 'Pasien Ops (Kandidat)' };
  }
  if (kind === 'crm_lead') {
    return { source: 'crm_lead_name_fuzzy', label: 'CRM Lead (Kandidat)' };
  }
  return { source: 'member_name_fuzzy', label: 'Kandidat Nama (Mirip)' };
}

/**
 * Resolve phone number and match candidates for a single affiliator using all
 * direct account/email records and member/patient/lead cross-matching indexes.
 */
export function resolveAffiliatorPhone(
  subject: AffiliatorMatchSubject,
  index: SearchIndexes
): AffiliatorPhoneResolution {
  const candidates = new Map<string, PhoneMatchCandidate>();
  const subjectFullName = fullNameFromParts(subject.firstName, subject.lastName);
  const subjectNames = [subjectFullName, ...subject.bankAccountNames].filter((n) => n.trim().length > 0);
  const preClaim = subject.affiliateCode
    ? index.byPreClaimCode.get(subject.affiliateCode.toUpperCase())
    : undefined;

  const emailsToCheck = [
    ...new Set(
      [normalizeEmail(subject.email), normalizeEmail(preClaim?.assignedEmail)].filter(
        (value): value is string => Boolean(value)
      )
    ),
  ];

  // 1. Direct verified / profile phone on the affiliator User row
  const directLoginPhone = normalizeIndoPhone(subject.loginPhone);
  if (directLoginPhone) {
    addCandidate(candidates, {
      phone: directLoginPhone,
      confidence: 'verified',
      source: 'login_phone',
      sourceLabel: 'WhatsApp Login',
      matchedName: subjectFullName,
      matchedUserId: subject.id,
      score: 100,
      reason: 'Nomor WhatsApp terverifikasi langsung di akun affiliator',
    });
  }

  const directProfilePhone = normalizeIndoPhone(subject.phone);
  if (directProfilePhone) {
    addCandidate(candidates, {
      phone: directProfilePhone,
      confidence: 'verified',
      source: 'user_profile',
      sourceLabel: 'Profil Member',
      matchedName: subjectFullName,
      matchedUserId: subject.id,
      score: 98,
      reason: 'Nomor HP tersimpan di profil akun affiliator',
    });
  }

  if (candidates.size > 0) {
    const verifiedCandidates = [...candidates.values()].sort((a, b) => b.score - a.score);
    const primary = verifiedCandidates[0];
    return {
      phone: primary.phone,
      displayPhone: primary.displayPhone,
      confidence: primary.confidence,
      source: primary.source,
      sourceLabel: primary.sourceLabel,
      reason: primary.reason,
      matchedMemberName: primary.matchedName,
      matchedMrNumber: null,
      candidates: verifiedCandidates,
    };
  }

  // 2. MemberPhoneRecovery, StaffAccount, Email-linked User, and transaction tables
  for (const recoveryPhone of index.byRecoveryUserId.get(subject.id) ?? []) {
    addCandidate(candidates, {
      phone: recoveryPhone,
      confidence: 'exact',
      source: 'phone_recovery',
      sourceLabel: 'Recovery Nomor',
      matchedName: subjectFullName,
      matchedUserId: subject.id,
      score: 96,
      reason: 'Nomor disetujui melalui recovery FO untuk akun ini',
    });
  }

  if (subject.clerkUserId) {
    const staff = index.byStaffLegacyId.get(subject.clerkUserId);
    const staffPhone = normalizeIndoPhone(staff?.phone);
    if (staff && staffPhone) {
      addCandidate(candidates, {
        phone: staffPhone,
        confidence: 'exact',
        source: 'staff_account',
        sourceLabel: 'Akun Staff',
        matchedName: staff.name,
        score: 95,
        reason: `Terhubung ke akun staff ${staff.name}`,
      });
    }
  }

  for (const email of emailsToCheck) {
    for (const staff of index.byStaffEmail.get(email) ?? []) {
      const staffPhone = normalizeIndoPhone(staff.phone);
      if (staffPhone) {
        addCandidate(candidates, {
          phone: staffPhone,
          confidence: 'exact',
          source: 'staff_account',
          sourceLabel: 'Akun Staff (Email)',
          matchedName: staff.name,
          score: 95,
          reason: `Email sama dengan akun staff ${staff.name}`,
        });
      }
    }

    for (const member of index.byEmail.get(email) ?? []) {
      if (member.userId === subject.id) continue;
      addCandidate(candidates, {
        phone: member.phone,
        confidence: 'exact',
        source: 'member_email_exact',
        sourceLabel: 'Member Lain (Email Sama)',
        matchedName: member.displayName,
        matchedUserId: member.userId,
        matchedMrNumber: member.mrNumber,
        score: 95,
        reason: `Ditemukan di data member lain dengan email sama (${member.displayName})`,
      });
    }

    matchEmailBackedRecords(
      index.byReservationEmail.get(email) ?? [],
      subjectNames,
      'reservation_email',
      'Reservasi',
      candidates
    );
    matchEmailBackedRecords(
      index.byOrderEmail.get(email) ?? [],
      subjectNames,
      'product_order_email',
      'Order Produk',
      candidates
    );
  }

  // Reservations owned by this affiliator userId (guard against booking for a friend)
  for (const res of subject.reservations) {
    const phone = normalizeIndoPhone(res.patientPhone);
    if (!phone) continue;
    const sameEmail = emailsToCheck.includes(normalizeEmail(res.patientEmail) ?? '');
    const sameName = subjectNames.some((name) => namesCompatible(name, res.patientName));
    if (sameEmail || sameName) {
      addCandidate(candidates, {
        phone,
        confidence: 'exact',
        source: 'reservation_user',
        sourceLabel: 'Reservasi Akun',
        matchedName: res.patientName,
        score: 92,
        reason: `Nomor dari reservasi pribadi atas nama ${res.patientName}`,
      });
    } else {
      addCandidate(candidates, {
        phone,
        confidence: 'candidate',
        source: 'reservation_user',
        sourceLabel: 'Reservasi Akun (Nama Beda)',
        matchedName: res.patientName,
        score: 68,
        reason: `Akun ini pernah membuat reservasi atas nama "${res.patientName}" (mungkin untuk orang lain)`,
      });
    }
  }

  if (preClaim?.notes) {
    for (const notePhone of extractPhonesFromText(preClaim.notes)) {
      addCandidate(candidates, {
        phone: notePhone,
        confidence: 'exact',
        source: 'preclaim_notes',
        sourceLabel: 'Catatan Kode Afiliasi',
        matchedName: subjectFullName,
        score: 87,
        reason: `Nomor ditemukan di catatan kode afiliasi ${preClaim.code}`,
      });
    }
  }

  // 3. Cross-match against Member, OpsPatient & CRM Lead records by Name, BankAccount.accountName, and Email prefix
  const nameQueries = collectNameQueries(subject);
  const emailNameCandidate = extractEmailNameCandidate(subject.email);

  for (const query of nameQueries) {
    const exactEntries = (index.byExactName.get(query.normalized) ?? []).filter(
      (entry) => entry.userId !== subject.id
    );
    const uniquePhones = [...new Set(exactEntries.map((e) => e.phone))];
    const allowSingleTokenExact = query.tokens.length >= 2 || query.normalized.length >= 4;

    if (exactEntries.length > 0 && allowSingleTokenExact) {
      const isUniquePhone = uniquePhones.length === 1;
      for (const entry of exactEntries) {
        const emailDisambiguates = !isUniquePhone && emailTokensMatchEntry(emailNameCandidate, entry);
        const isHigh = isUniquePhone || emailDisambiguates;
        const meta = exactDirectoryMeta(entry.kind, query.origin, isHigh);
        addCandidate(candidates, {
          phone: entry.phone,
          confidence: isHigh ? 'high' : 'candidate',
          source: meta.source,
          sourceLabel: meta.label,
          matchedName: entry.displayName,
          matchedUserId: entry.userId,
          matchedMrNumber: entry.mrNumber,
          score: isHigh ? (emailDisambiguates ? meta.baseScore + 1 : meta.baseScore) : 73,
          reason:
            query.origin === 'bank'
              ? `Nama rekening "${query.rawName}" cocok persis dengan ${entry.displayName}${entry.mrNumber ? ` (RM ${entry.mrNumber})` : ''}`
              : isUniquePhone
                ? `Nama cocok persis dengan ${meta.entityNoun} ${entry.displayName}${entry.mrNumber ? ` (RM ${entry.mrNumber})` : ''}`
                : `Ada ${uniquePhones.length} nomor berbeda dengan nama persis "${entry.displayName}"`,
        });
      }
    }

    if (query.tokens.length >= 2) {
      const sortedKey = [...query.tokens].sort().join(' ');
      const reorderedEntries = (index.bySortedTokens.get(sortedKey) ?? []).filter(
        (entry) => entry.userId !== subject.id && entry.normalizedName !== query.normalized
      );
      for (const entry of reorderedEntries) {
        const meta = fuzzyDirectoryMeta(entry.kind, query.origin);
        addCandidate(candidates, {
          phone: entry.phone,
          confidence: 'candidate',
          source: meta.source,
          sourceLabel: query.origin === 'bank' ? 'Nama Rekening (Urutan Beda)' : 'Kandidat Nama (Urutan Beda)',
          matchedName: entry.displayName,
          matchedUserId: entry.userId,
          matchedMrNumber: entry.mrNumber,
          score: 77,
          reason: `Kata nama "${query.rawName}" sama dengan "${entry.displayName}" dalam urutan berbeda`,
        });
      }
    }

    const bucketPool = new Map<string, IndexedDirectoryEntry>();
    for (const token of query.tokens) {
      if (token.length < 3) continue;
      const bucket = index.byToken.get(token) ?? [];
      if (bucket.length > 350 && query.tokens.length === 1 && !emailNameCandidate) {
        continue;
      }
      for (const entry of bucket.slice(0, 350)) {
        if (entry.userId === subject.id) continue;
        bucketPool.set(`${entry.kind}:${entry.phone}:${entry.normalizedName}`, entry);
      }
    }

    for (const entry of bucketPool.values()) {
      if (entry.normalizedName === query.normalized) continue;

      const sharedTokens = query.tokens.filter((t) => entry.tokens.includes(t));
      const allQueryInEntry = query.tokens.length >= 2 && query.tokens.every((t) => entry.tokens.includes(t));
      const allEntryInQuery = entry.tokens.length >= 2 && entry.tokens.every((t) => query.tokens.includes(t));
      const emailBoost = emailTokensMatchEntry(emailNameCandidate, entry);

      let fuzzyScore = 0;
      let reason = '';

      if (allQueryInEntry || allEntryInQuery) {
        const ratio = sharedTokens.length / Math.max(query.tokens.length, entry.tokens.length);
        fuzzyScore = Math.round(68 + ratio * 10);
        reason =
          query.origin === 'bank'
            ? `Nama rekening "${query.rawName}" bagian dari nama "${entry.displayName}"`
            : `Nama "${query.rawName}" cocok sebagian dengan "${entry.displayName}"`;
      } else if (query.tokens.length === 1 && emailBoost) {
        fuzzyScore = 74;
        reason = `Nama depan "${query.rawName}" + prefix email cocok dengan "${entry.displayName}"`;
      } else if (
        query.tokens.length === 1 &&
        query.normalized.length >= 6 &&
        entry.tokens[0] === query.tokens[0] &&
        (index.byToken.get(query.tokens[0])?.length ?? 0) <= 5
      ) {
        fuzzyScore = 66;
        reason = `Nama unik "${query.rawName}" cocok sebagai nama awal "${entry.displayName}"`;
      } else if (query.normalized.length >= 6 && entry.normalizedName.length >= 6) {
        const similarity = stringSimilarity(query.normalized, entry.normalizedName);
        if (similarity >= 0.85) {
          fuzzyScore = Math.round(64 + similarity * 14);
          reason = `Kemiripan ejaan ${Math.round(similarity * 100)}% antara "${query.rawName}" dan "${entry.displayName}"`;
        }
      }

      if (fuzzyScore > 0) {
        if (emailBoost && fuzzyScore < 76) fuzzyScore += 4;
        const meta = fuzzyDirectoryMeta(entry.kind, query.origin);
        addCandidate(candidates, {
          phone: entry.phone,
          confidence: 'candidate',
          source: meta.source,
          sourceLabel: meta.label,
          matchedName: entry.displayName,
          matchedUserId: entry.userId,
          matchedMrNumber: entry.mrNumber,
          score: Math.min(fuzzyScore, 79),
          reason,
        });
      }
    }
  }

  // 4. Email-prefix matching when display name was a nickname / unhelpful
  if (emailNameCandidate) {
    if (emailNameCandidate.compact.length >= 8) {
      for (const entry of index.byCompactName.get(emailNameCandidate.compact) ?? []) {
        if (entry.userId === subject.id) continue;
        addCandidate(candidates, {
          phone: entry.phone,
          confidence: 'candidate',
          source: 'email_prefix_name',
          sourceLabel: 'Nama Email -> Member',
          matchedName: entry.displayName,
          matchedUserId: entry.userId,
          matchedMrNumber: entry.mrNumber,
          score: 76,
          reason: `Prefix email cocok dengan nama "${entry.displayName}"`,
        });
      }
    }

    if (emailNameCandidate.tokens.length >= 2) {
      const spacedExact = index.byExactName.get(emailNameCandidate.spaced) ?? [];
      for (const entry of spacedExact) {
        if (entry.userId === subject.id) continue;
        addCandidate(candidates, {
          phone: entry.phone,
          confidence: 'candidate',
          source: 'email_prefix_name',
          sourceLabel: 'Nama Email -> Member',
          matchedName: entry.displayName,
          matchedUserId: entry.userId,
          matchedMrNumber: entry.mrNumber,
          score: 76,
          reason: `Nama dari email (${emailNameCandidate.spaced}) cocok dengan "${entry.displayName}"`,
        });
      }
    }
  }

  const sortedCandidates = [...candidates.values()].sort((a, b) => b.score - a.score).slice(0, 5);
  const top = sortedCandidates[0];

  if (!top) {
    return {
      phone: null,
      displayPhone: null,
      confidence: 'none',
      source: 'none',
      sourceLabel: 'Belum ditemukan',
      reason: 'Tidak ditemukan nomor HP yang cocok di profil, transaksi, maupun data member',
      matchedMemberName: null,
      matchedMrNumber: null,
      candidates: [],
    };
  }

  return {
    phone: top.phone,
    displayPhone: top.displayPhone,
    confidence: top.confidence,
    source: top.source,
    sourceLabel: top.sourceLabel,
    reason: top.reason,
    matchedMemberName: top.matchedName,
    matchedMrNumber: top.matchedMrNumber ?? null,
    candidates: sortedCandidates,
  };
}
