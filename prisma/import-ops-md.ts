import { hash } from 'argon2';
import { randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Prisma, PrismaClient, type OpsRole } from '@prisma/client';
import { normalizeOpsEmail, validateOpsEmail } from '../src/lib/treatment-operations/password';

const prisma = new PrismaClient();

const ROLE_ALIASES: Record<string, OpsRole> = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  'SUPER ADMIN': 'SUPER_ADMIN',
  FINANCE: 'FINANCE',
  MANAGEMENT: 'MANAGEMENT',
  MANAJEMEN: 'MANAGEMENT',
  FRONT_OFFICE: 'FRONT_OFFICE',
  'FRONT OFFICE': 'FRONT_OFFICE',
  'FRONT-OFFICE': 'FRONT_OFFICE',
  SUPERVISOR: 'SUPERVISOR',
  THERAPIST: 'THERAPIST',
  TERAPIS: 'THERAPIST',
  DOCTOR: 'DOCTOR',
  DOKTER: 'DOCTOR',
  APOTEKER: 'APOTEKER',
  ASISTEN_APOTEKER: 'ASISTEN_APOTEKER',
  'ASISTEN APOTEKER': 'ASISTEN_APOTEKER',
  PERAWAT: 'PERAWAT',
};

type EmployeeRow = {
  email: string;
  name: string;
  employeeId: string;
  role: OpsRole;
  branchCode: string;
  password: string | null;
};

type StepRow = {
  actionName: string;
  sequenceNumber: number;
  isRequired: boolean;
  requiredRole: OpsRole | null;
  estimatedDurationMinutes: number | null;
  incentiveValue: number;
};

type TreatmentRow = {
  name: string;
  code: string;
  category: string | null;
  price: number;
  steps: StepRow[];
};

function normalizeRole(value: string): OpsRole | null {
  const key = value.trim().toUpperCase();
  return ROLE_ALIASES[key] ?? null;
}

function parseBool(value: string): boolean {
  return ['ya', 'true', '1', 'y', '✓', 'wajib', 'v'].includes(value.trim().toLowerCase());
}

function parseNumber(value: string): number {
  const cleaned = value.replace(/[^\d.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isSeparator(cells: string[]): boolean {
  return cells.every((cell) => /^:?-{2,}:?$/.test(cell.trim()));
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function generatePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#%^*';
  const all = upper + lower + digits + symbols;
  let password = upper[randomInt(upper.length)] + lower[randomInt(lower.length)] + digits[randomInt(digits.length)] + symbols[randomInt(symbols.length)];
  for (let i = 0; i < 12; i += 1) password += all[randomInt(all.length)];
  const chars = password.split('');
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export function parseDocument(text: string): { employees: EmployeeRow[]; treatments: TreatmentRow[]; errors: string[] } {
  const employees: EmployeeRow[] = [];
  const treatments: TreatmentRow[] = [];
  const errors: string[] = [];

  let section: 'none' | 'employees' | 'treatments' = 'none';
  let current: TreatmentRow | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('## ')) {
      const title = line.slice(3).trim().toLowerCase();
      section = title.startsWith('karyawan') ? 'employees' : title.startsWith('treatment') ? 'treatments' : 'none';
      current = null;
      continue;
    }

    if (section === 'employees') {
      if (!line.startsWith('|')) continue;
      const cells = parseTableRow(line);
      if (cells.length === 0 || isSeparator(cells)) continue;
      if (cells[0].toLowerCase() === 'email') continue; // header row

      const [emailRaw, nameRaw, employeeIdRaw, roleRaw, branchRaw, passwordRaw] = cells;
      const email = normalizeOpsEmail(emailRaw || '');
      const role = normalizeRole(roleRaw || '');
      if (!email || validateOpsEmail(email)) {
        errors.push(`Karyawan: email tidak valid -> ${emailRaw || '(kosong)'}`);
        continue;
      }
      if (!role) {
        errors.push(`Karyawan ${email}: role tidak dikenal -> ${roleRaw || '(kosong)'}`);
        continue;
      }
      employees.push({
        email,
        name: (nameRaw || '').trim(),
        employeeId: (employeeIdRaw || '').trim().toUpperCase(),
        role,
        branchCode: (branchRaw || 'DRW-UTAMA').trim().toUpperCase(),
        password: (passwordRaw || '').trim() || null,
      });
      continue;
    }

    if (section === 'treatments') {
      if (line.startsWith('### ')) {
        const header = line.slice(4).trim();
        const match = header.match(/^(.*?)\s*\(([A-Za-z0-9-]+)\)$/i);
        current = {
          name: match ? match[1].trim() : header,
          code: match ? match[2].toUpperCase() : header.toUpperCase().replace(/\s+/g, '-'),
          category: null,
          price: 0,
          steps: [],
        };
        treatments.push(current);
        continue;
      }
      if (!current) continue;

      if (/kategori:|harga:/i.test(line)) {
        for (const part of line.split('|')) {
          const [key, ...rest] = part.split(':');
          const name = key.trim().toLowerCase();
          const value = rest.join(':').trim();
          if (name === 'kategori') current.category = value || null;
          if (name === 'harga') current.price = parseNumber(value);
        }
        continue;
      }

      if (!line.startsWith('|')) continue;
      const cells = parseTableRow(line);
      if (cells.length === 0 || isSeparator(cells)) continue;
      if (['no', 'nomor'].includes(cells[0].toLowerCase())) continue; // header row

      const requiredRole = normalizeRole(cells[3] || '');
      current.steps.push({
        actionName: (cells[1] || '').trim(),
        sequenceNumber: parseNumber(cells[0]) || current.steps.length + 1,
        isRequired: parseBool(cells[2] || 'ya'),
        requiredRole: requiredRole ?? null,
        estimatedDurationMinutes: parseNumber(cells[4] || '') || null,
        incentiveValue: parseNumber(cells[5] || '0'),
      });
    }
  }

  for (const treatment of treatments) {
    if (treatment.steps.length === 0) errors.push(`Treatment ${treatment.code}: tidak ada tahapan tindakan.`);
    for (const step of treatment.steps) {
      if (!step.actionName) errors.push(`Treatment ${treatment.code}: ada tahapan tanpa nama.`);
    }
  }

  return { employees, treatments, errors };
}

async function importEmployees(rows: EmployeeRow[]): Promise<{ created: string[]; skipped: string[]; generated: Array<{ email: string; password: string }> }> {
  const created: string[] = [];
  const skipped: string[] = [];
  const generated: Array<{ email: string; password: string }> = [];

  for (const row of rows) {
    const existing = await prisma.opsStaff.findUnique({ where: { email: row.email } });
    if (existing) {
      skipped.push(row.email);
      continue;
    }
    if (!row.name || !row.employeeId) {
      skipped.push(`${row.email} (nama/ID tidak lengkap)`);
      continue;
    }

    const branch = (await prisma.opsBranch.findUnique({ where: { code: row.branchCode } }))
      ?? (await prisma.opsBranch.findFirst({ where: { active: true }, orderBy: { name: 'asc' } }));
    if (!branch) throw new Error('Tidak ada cabang aktif untuk impor karyawan.');

    let password = row.password;
    if (!password) {
      password = generatePassword();
      generated.push({ email: row.email, password });
    }
    // Provided passwords are treated as temporary: the account is forced to
    // change them on first login, where the strong policy is enforced.

    const passwordHash = await hash(password);
    await prisma.$transaction(async (tx) => {
      const staff = await tx.opsStaff.create({
        data: {
          branchId: branch.id,
          username: row.email,
          email: row.email,
          employeeId: row.employeeId,
          name: row.name,
          role: row.role,
          passwordHash,
          mustChangePassword: true,
        },
      });
      if (row.role === 'DOCTOR') {
        await tx.opsDoctor.create({ data: { branchId: branch.id, staffId: staff.id, name: row.name } });
      }
      await tx.opsAuditLog.create({
        data: {
          actorUserId: staff.id,
          branchId: branch.id,
          entityType: 'STAFF_ACCOUNT',
          entityId: staff.id,
          action: 'IMPORT_CREATE',
          afterData: { email: row.email, employeeId: row.employeeId, role: row.role, mustChangePassword: true },
        },
      });
    });
    created.push(row.email);
  }

  return { created, skipped, generated };
}

async function importTreatments(rows: TreatmentRow[]): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];

  for (const row of rows) {
    if (!row.code) {
      skipped.push(`${row.name || '(tanpa kode)'} (kode kosong)`);
      continue;
    }
    const existing = await prisma.opsTreatment.findUnique({ where: { code: row.code } });
    if (existing) {
      skipped.push(row.code);
      continue;
    }
    await prisma.$transaction(async (tx) => {
      const treatment = await tx.opsTreatment.create({
        data: {
          code: row.code,
          name: row.name,
          category: row.category,
          defaultPrice: new Prisma.Decimal(row.price),
          actionTemplates: {
            create: row.steps.map((step) => ({
              actionName: step.actionName,
              sequenceNumber: step.sequenceNumber,
              isRequired: step.isRequired,
              requiredRole: step.requiredRole,
              estimatedDurationMinutes: step.estimatedDurationMinutes,
              incentiveType: 'FIXED',
              incentiveValue: new Prisma.Decimal(step.incentiveValue),
            })),
          },
        },
      });
      await tx.opsAuditLog.create({
        data: {
          actorUserId: (await tx.opsStaff.findFirst({ where: { role: 'SUPER_ADMIN' } }))?.id ?? 'import',
          entityType: 'TREATMENT',
          entityId: treatment.id,
          action: 'IMPORT_CREATE',
          afterData: { code: row.code, name: row.name, steps: row.steps.length },
        },
      });
    });
    created.push(row.code);
  }

  return { created, skipped };
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Gunakan: npm run ops:import-md -- <path-ke-file.md>');
    process.exit(1);
  }

  const text = readFileSync(filePath, 'utf8');
  const { employees, treatments, errors } = parseDocument(text);

  if (errors.length > 0) {
    console.error('Masalah pada file:');
    for (const error of errors) console.error(`  - ${error}`);
  }

  const staffResult = await importEmployees(employees);
  const treatmentResult = await importTreatments(treatments);

  console.log('\n=== KARYAWAN ===');
  console.log(`Dibuat: ${staffResult.created.length}`);
  for (const email of staffResult.created) console.log(`  + ${email}`);
  console.log(`Dilewati (sudah ada / tidak valid): ${staffResult.skipped.length}`);
  for (const email of staffResult.skipped) console.log(`  ~ ${email}`);
  if (staffResult.generated.length > 0) {
    console.log('\nPassword awal (wajib diganti saat login pertama):');
    for (const item of staffResult.generated) console.log(`  ${item.email} -> ${item.password}`);
  }

  console.log('\n=== TREATMENT ===');
  console.log(`Dibuat: ${treatmentResult.created.length}`);
  for (const code of treatmentResult.created) console.log(`  + ${code}`);
  console.log(`Dilewati (sudah ada): ${treatmentResult.skipped.length}`);
  for (const code of treatmentResult.skipped) console.log(`  ~ ${code}`);
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('import-ops-md.ts')) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
