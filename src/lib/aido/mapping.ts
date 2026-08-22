type JsonRecord = Record<string, unknown>;

export type AidoPatient = {
  externalPatientId: string;
  externalPatientNumericId: string | null;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  mrNumber: string | null;
  nik: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
};

export type AidoIncome = {
  externalId: string;
  externalPatientId: string | null;
  externalPatientNumericId: string | null;
  mrNumber: string | null;
  registrationNumber: string | null;
  receiptNumber: string | null;
  patientName: string | null;
  transactionDate: Date;
  amount: number;
  treatment: string | null;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getPath(record: JsonRecord, path: string): unknown {
  let current: unknown = record;

  for (const part of path.split('.')) {
    if (!isRecord(current)) return undefined;
    const exact = current[part];
    if (exact !== undefined) {
      current = exact;
      continue;
    }

    const matchingKey = Object.keys(current).find((key) => key.toLowerCase() === part.toLowerCase());
    if (!matchingKey) return undefined;
    current = current[matchingKey];
  }

  return current;
}

function readString(record: JsonRecord, paths: string[]): string | null {
  for (const path of paths) {
    const value = getPath(record, path);
    if (value === null || value === undefined) continue;
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    if (typeof value === 'number' && !Number.isFinite(value)) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return null;
}

function readNumber(record: JsonRecord, paths: string[]): number | null {
  for (const path of paths) {
    const value = getPath(record, path);
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') continue;

    const compact = value.trim().replace(/[^0-9,.-]/g, '');
    if (!compact) continue;

    let normalized = compact;
    const commaCount = (compact.match(/,/g) || []).length;
    const dotCount = (compact.match(/\./g) || []).length;

    if (commaCount > 0 && dotCount > 0) {
      const decimalSeparator = compact.lastIndexOf(',') > compact.lastIndexOf('.') ? ',' : '.';
      const thousandsSeparator = decimalSeparator === ',' ? /\./g : /,/g;
      normalized = compact.replace(thousandsSeparator, '').replace(decimalSeparator, '.');
    } else if (commaCount > 1 || (commaCount === 1 && /,\d{3}$/.test(compact))) {
      normalized = compact.replace(/,/g, '');
    } else if (dotCount > 1 || (dotCount === 1 && /\.\d{3}$/.test(compact))) {
      normalized = compact.replace(/\./g, '');
    } else if (commaCount === 1) {
      normalized = compact.replace(',', '.');
    }

    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function normalizeAidoPhone(value: string | null): string | null {
  if (!value) return null;
  let digits = value.replace(/\D/g, '');

  if (digits.startsWith('62')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);

  if (!digits.startsWith('8') || digits.length < 8 || digits.length > 13) return null;
  return `62${digits}`;
}

export function normalizeAidoName(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID');
  return normalized || null;
}

function normalizeNik(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return /^\d{16}$/.test(digits) ? digits : null;
}

function hasValidDateParts(year: string, month: string, day: string): boolean {
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year)
    && date.getUTCMonth() === Number(month) - 1
    && date.getUTCDate() === Number(day);
}

export function parseAidoDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string' && typeof value !== 'number') return null;

  const text = String(value).trim();
  if (!text) return null;

  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    if (!hasValidDateParts(dateOnly[1], dateOnly[2], dateOnly[3])) return null;
    const date = new Date(`${text}T00:00:00+07:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const indonesiaDate = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (indonesiaDate) {
    const [, day, month, year] = indonesiaDate;
    if (!hasValidDateParts(year, month, day)) return null;
    const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00+07:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
  const isoLike = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(text);
  if (isoLike && !hasValidDateParts(text.slice(0, 4), text.slice(5, 7), text.slice(8, 10))) {
    return null;
  }
  const date = new Date(isoLike && !hasTimezone ? `${text.replace(' ', 'T')}+07:00` : text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseAidoBirthDate(value: unknown): Date | null {
  if (typeof value === 'string') {
    const text = value.trim();
    const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) {
      if (!hasValidDateParts(dateOnly[1], dateOnly[2], dateOnly[3])) return null;
      return new Date(`${text}T00:00:00Z`);
    }

    const indonesiaDate = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (indonesiaDate) {
      const [, day, month, year] = indonesiaDate;
      if (!hasValidDateParts(year, month, day)) return null;
      return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`);
    }
  }
  return parseAidoDate(value);
}

export function mapAidoPatient(raw: unknown): AidoPatient | null {
  if (!isRecord(raw)) return null;

  const uuid = readString(raw, [
    'uuid',
    'patientUuid',
    'patientsUuid',
    'patientsMrUuid',
    'patient.uuid',
  ]);
  const numericId = readString(raw, [
    'id',
    'patientId',
    'patientsId',
    'patientsMrId',
    'patient.id',
  ]);
  const externalPatientId = uuid || (numericId ? `id:${numericId}` : null);
  const fullName = readString(raw, ['patientName', 'fullName', 'fullname', 'name']);
  let firstName = readString(raw, ['firstName', 'firstname', 'patientFirstName']);
  let lastName = readString(raw, ['lastName', 'lastname', 'patientLastName']);

  if (!firstName && fullName) {
    firstName = fullName;
    lastName = null;
  }

  if (!externalPatientId || !firstName) return null;

  const genderValue = readString(raw, ['gender', 'patientGender']);
  const gender = genderValue
    ? ['L', 'M', 'MALE', 'PRIA'].includes(genderValue.toUpperCase())
      ? 'Pria'
      : ['P', 'F', 'FEMALE', 'WANITA'].includes(genderValue.toUpperCase())
        ? 'Wanita'
        : null
    : null;

  return {
    externalPatientId,
    externalPatientNumericId: numericId,
    firstName,
    lastName,
    phone: normalizeAidoPhone(readString(raw, ['waNumber', 'whatsapp', 'phoneNumber', 'phone'])),
    mrNumber: readString(raw, ['mrNumber', 'patientMr', 'noRm', 'nomorRm', 'patient.mrNumber']),
    nik: normalizeNik(readString(raw, ['nik', 'identityNumber', 'idCardNumber', 'noKtp'])),
    dateOfBirth: parseAidoBirthDate(readString(raw, ['dob', 'dateOfBirth', 'patientDob'])),
    gender,
  };
}

export function mapAidoIncome(raw: unknown): AidoIncome | null {
  if (!isRecord(raw)) return null;

  const transactionDate = parseAidoDate(
    readString(raw, ['paymentdate', 'paymentDate', 'transactionDate', 'trxDate', 'createdAt'])
  );
  const amount = readNumber(raw, ['totalbill', 'totalBill', 'totalPayment', 'amount']);
  const registrationNumber = readString(raw, [
    'registrationnumber',
    'registrationNumber',
    'registration.number',
  ]);
  const receiptNumber = readString(raw, ['nomorkwitansi', 'nomorKwitansi', 'receiptNumber', 'invoiceNumber']);
  const directExternalId = readString(raw, [
    'trxuuid',
    'trxUuid',
    'transactionUuid',
    'uuid',
    'trxnumber',
    'trxNumber',
    'transactionNumber',
    'id',
  ]);
  if (!directExternalId || !transactionDate || amount === null || amount < 0) return null;

  const visitName = readString(raw, ['visitname', 'visitName', 'treatment', 'procedureName']);
  const categoryName = readString(raw, [
    'medicalcategoriesname',
    'medicalCategoriesName',
    'medicalCategoryName',
  ]);
  const treatmentParts = [...new Set([visitName, categoryName].filter((value): value is string => Boolean(value)))];

  return {
    externalId: directExternalId,
    externalPatientId: readString(raw, [
      'patientUuid',
      'patientsUuid',
      'patient.uuid',
    ]),
    externalPatientNumericId: readString(raw, [
      'patientId',
      'patientsId',
      'pmrId',
      'patientMrId',
      'patient.id',
    ]),
    mrNumber: readString(raw, ['mrNumber', 'patientMr', 'patient.mrNumber']),
    registrationNumber,
    receiptNumber,
    patientName: readString(raw, [
      'firstnamedecoded',
      'patientName',
      'fullname',
      'patient.fullName',
    ]),
    transactionDate,
    amount,
    treatment: treatmentParts.length > 0 ? treatmentParts.join(' - ') : null,
  };
}

export function isValidSyncDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function getPreviousJakartaDate(now = new Date()): string {
  const previousDay = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(previousDay);
}

export function getJakartaDateRange(date: string): { start: Date; end: Date } {
  if (!isValidSyncDate(date)) throw new Error('Invalid sync date');
  const start = new Date(`${date}T00:00:00+07:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}
