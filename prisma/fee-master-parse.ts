export type FeeMasterRow = {
  name: string;
  fee: number;
  doctorFee: number;
};

export type FeeTreatmentStep = {
  actionName: string;
  sequenceNumber: number;
  isRequired: boolean;
  requiredRole: 'THERAPIST' | 'DOCTOR';
  incentiveType: 'FIXED';
  incentiveValue: number;
};

export const FEE_MASTER_CATEGORIES = [
  'Home Treatment',
  'Hair',
  'Nail',
  'Lash',
  'Body & Spa',
  'Dermapen',
  'HIFU',
  'Skin Booster',
  'Botox',
  'Pico',
  'IPL',
  'Peel',
  'Facial',
  'Vitamin',
  'Masker',
  'Injection',
  'Tindakan Medis',
  'Lainnya',
] as const;

export const EXACT_PROTOCOL_MAPPING: Record<string, string> = {
  'Dermapen PRP': 'PRT-DERMA-PRP',
  'Dermapen DNA Salmon': 'PRT-DERMA-DNA-MELASMA',
  'Dermapen Melasma': 'PRT-DERMA-DNA-MELASMA',
};

export function treatmentMappingStatus(name: string): 'EXACT_NAME' | 'PENDING_CONFIRMATION' {
  return name in EXACT_PROTOCOL_MAPPING ? 'EXACT_NAME' : 'PENDING_CONFIRMATION';
}

export function treatmentProtocolCode(name: string): string | null {
  return EXACT_PROTOCOL_MAPPING[name] ?? null;
}

const CATEGORY_RULES: Array<[RegExp, string]> = [
  [/\(HOME\)/i, 'Home Treatment'],
  [/DERMAPEN/i, 'Dermapen'],
  [/HIFU/i, 'HIFU'],
  [/SKIN BOOSTER/i, 'Skin Booster'],
  [/BOTOX/i, 'Botox'],
  [/PICO/i, 'Pico'],
  [/IPL/i, 'IPL'],
  [/PEEL/i, 'Peel'],
  [/FACIAL/i, 'Facial'],
  [/VITAMIN/i, 'Vitamin'],
  [/MASKER/i, 'Masker'],
  [/PRP|MESO|INJECTION/i, 'Injection'],
  [/CAUTER/i, 'Tindakan Medis'],
  [/HAIR|WASH/i, 'Hair'],
  [/NAIL|MANICURE|MENICURE|PEDICURE|CHROME|GRADIASI|HAND SPA|FOOT SPA/i, 'Nail'],
  [/LASH/i, 'Lash'],
  [/LYMPHATIC|MASSAGE|HOT STONE|RATUS|SAUNA|BODY SPA|BERENDAM/i, 'Body & Spa'],
];

export function categorizeTreatment(name: string): string {
  for (const [rule, category] of CATEGORY_RULES) {
    if (rule.test(name)) return category;
  }
  return 'Lainnya';
}

export function parseIdr(value: string | undefined): number {
  const text = (value || '').trim();
  if (!text) return Number.NaN;
  const digits = text.replace(/\D/g, '');
  return digits ? Number(digits) : Number.NaN;
}

export function makeTreatmentCode(name: string): string {
  return name
    .toUpperCase()
    .replace(/['’]/g, '')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 60);
}

export function buildTreatmentSteps(row: FeeMasterRow): FeeTreatmentStep[] {
  const steps: FeeTreatmentStep[] = [{
    actionName: 'Pelaksanaan treatment',
    sequenceNumber: 1,
    isRequired: true,
    requiredRole: 'THERAPIST',
    incentiveType: 'FIXED',
    incentiveValue: row.fee,
  }];
  if (row.doctorFee > 0) {
    steps.push({
      actionName: 'Tindakan dokter',
      sequenceNumber: 2,
      isRequired: false,
      requiredRole: 'DOCTOR',
      incentiveType: 'FIXED',
      incentiveValue: row.doctorFee,
    });
  }
  return steps;
}

export function parseCsvCells(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') {
      inQuotes = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (character !== '\r') {
      field += character;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function parseFeeCsv(text: string): { rows: FeeMasterRow[]; errors: string[] } {
  const cells = parseCsvCells(text.replace(/^\uFEFF/, ''));
  let headerIndex = -1;
  for (let index = 0; index < cells.length; index += 1) {
    const first = (cells[index][0] || '').trim().toLowerCase();
    if (first.startsWith('nama treatment')) {
      headerIndex = index;
      break;
    }
  }

  const dataRows = headerIndex >= 0 ? cells.slice(headerIndex + 1) : cells;
  const rows: FeeMasterRow[] = [];
  const errors: string[] = [];

  for (const rowCells of dataRows) {
    const name = (rowCells[0] || '').trim();
    if (!name || name.startsWith('#')) continue;
    const fee = parseIdr(rowCells[1]);
    const doctorFee = parseIdr(rowCells[2]);
    if (Number.isNaN(fee) || Number.isNaN(doctorFee)) {
      errors.push(`Baris "${name}": nilai fee tidak valid.`);
      continue;
    }
    rows.push({ name, fee, doctorFee });
  }

  return { rows, errors };
}
