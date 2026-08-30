import { readFileSync } from 'node:fs';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  buildTreatmentSteps,
  categorizeTreatment,
  makeTreatmentCode,
  parseFeeCsv,
  treatmentMappingStatus,
  treatmentProtocolCode,
  type FeeMasterRow,
} from './fee-master-parse';

const prisma = new PrismaClient();

type ImportRow = FeeMasterRow & {
  code: string;
  category: string;
  mappingStatus: 'EXACT_NAME' | 'PENDING_CONFIRMATION';
  protocolCode: string | null;
};

const SUSPICIOUS_TOKENS = [
  'Purifiying', 'Clarifiying', 'Smooting', 'Menicure', 'Ruyssian', 'Subsisi',
  'Whispie', 'Georgeus', 'Gliter', 'Dandruf', 'Braziliant', 'Rejuve', 'Javanesse',
];

function flagSuspiciousNames(rows: FeeMasterRow[]): string[] {
  return rows
    .filter((row) => SUSPICIOUS_TOKENS.some((token) => row.name.includes(token)))
    .map((row) => row.name);
}

function buildRows(rows: FeeMasterRow[]): { rows: ImportRow[]; duplicateCodes: string[] } {
  const seen = new Map<string, string>();
  const duplicateCodes: string[] = [];
  const result: ImportRow[] = [];

  for (const row of rows) {
    const code = makeTreatmentCode(row.name);
    if (seen.has(code)) {
      if (!duplicateCodes.includes(code)) duplicateCodes.push(code);
      seen.set(code, `${seen.get(code)} | ${row.name}`);
      continue;
    }
    seen.set(code, row.name);
    result.push({
      ...row,
      code,
      category: categorizeTreatment(row.name),
      mappingStatus: treatmentMappingStatus(row.name),
      protocolCode: treatmentProtocolCode(row.name),
    });
  }

  return { rows: result, duplicateCodes };
}

async function importTreatments(rows: ImportRow[]): Promise<{ created: string[]; updated: string[]; skipped: string[] }> {
  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];
  const admin = await prisma.opsStaff.findFirst({ where: { role: 'SUPER_ADMIN' }, select: { id: true } });
  const protocols = await prisma.opsTreatmentProtocol.findMany({ select: { id: true, code: true } });
  const protocolIdByCode = new Map(protocols.map((protocol) => [protocol.code, protocol.id]));

  for (const row of rows) {
    const steps = buildTreatmentSteps(row);
    const protocolId = row.protocolCode ? protocolIdByCode.get(row.protocolCode) ?? null : null;
    await prisma.$transaction(async (tx) => {
      const existing = await tx.opsTreatment.findUnique({ where: { code: row.code } });
      if (existing) {
        await tx.opsTreatmentActionTemplate.deleteMany({ where: { treatmentId: existing.id } });
        await tx.opsTreatment.update({
          where: { id: existing.id },
          data: {
            name: row.name,
            category: row.category,
            defaultPrice: new Prisma.Decimal(0),
            active: false,
            protocolId,
            mappingStatus: row.mappingStatus,
            requiresDoctor: row.doctorFee > 0,
            staffFeeIdr: row.fee,
            doctorFeeIdr: row.doctorFee,
            actionTemplates: {
              create: steps.map((step) => ({
                actionName: step.actionName,
                sequenceNumber: step.sequenceNumber,
                isRequired: step.isRequired,
                requiredRole: step.requiredRole,
                incentiveType: step.incentiveType,
                incentiveValue: new Prisma.Decimal(step.incentiveValue),
              })),
            },
          },
        });
        updated.push(row.code);
        if (admin) {
          await tx.opsAuditLog.create({
            data: {
              actorUserId: admin.id,
              entityType: 'TREATMENT',
              entityId: existing.id,
              action: 'IMPORT_UPDATE',
              reason: 'Impor master fee dari CSV',
              afterData: { code: row.code, name: row.name, steps: steps.length, mappingStatus: row.mappingStatus },
            },
          });
        }
        return;
      }

      const createdTreatment = await tx.opsTreatment.create({
        data: {
          code: row.code,
          name: row.name,
          category: row.category,
          defaultPrice: new Prisma.Decimal(0),
          active: false,
          protocolId,
          mappingStatus: row.mappingStatus,
          requiresDoctor: row.doctorFee > 0,
          staffFeeIdr: row.fee,
          doctorFeeIdr: row.doctorFee,
          actionTemplates: {
            create: steps.map((step) => ({
              actionName: step.actionName,
              sequenceNumber: step.sequenceNumber,
              isRequired: step.isRequired,
              requiredRole: step.requiredRole,
              incentiveType: step.incentiveType,
              incentiveValue: new Prisma.Decimal(step.incentiveValue),
            })),
          },
        },
      });
      created.push(row.code);
      if (admin) {
        await tx.opsAuditLog.create({
          data: {
            actorUserId: admin.id,
            entityType: 'TREATMENT',
            entityId: createdTreatment.id,
            action: 'IMPORT_CREATE',
            reason: 'Impor master fee dari CSV',
            afterData: { code: row.code, name: row.name, steps: steps.length, mappingStatus: row.mappingStatus },
          },
        });
      }
    });
  }

  return { created, updated, skipped };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const filePath = args.find((argument) => !argument.startsWith('--'));
  if (!filePath) {
    console.error('Gunakan: npm run ops:import-fee -- <path-ke-file.csv> [--dry-run]');
    process.exit(1);
  }

  const text = readFileSync(filePath, 'utf8');
  const { rows, errors } = parseFeeCsv(text);
  for (const error of errors) console.error(`  - ${error}`);

  const { rows: built, duplicateCodes } = buildRows(rows);
  if (duplicateCodes.length > 0) {
    console.error('\nKode treatment ganda (nama berbeda menghasilkan kode sama):');
    for (const code of duplicateCodes) console.error(`  - ${code}`);
  }

  const byCategory = new Map<string, number>();
  for (const row of built) byCategory.set(row.category, (byCategory.get(row.category) || 0) + 1);

  console.log('\n=== RINGKASAN MASTER ===');
  console.log(`Baris terbaca: ${rows.length} | Tidak valid: ${errors.length} | Masuk impor: ${built.length}`);
  console.log('\nKategori:');
  for (const [category, count] of [...byCategory.entries()].sort()) console.log(`  ${category}: ${count}`);

  const withDoctorFee = built.filter((row) => row.doctorFee > 0).length;
  console.log(`\nDengan tahap dokter opsional: ${withDoctorFee}`);
  console.log('Semua treatment dibuat NONAKTIF (harga jual 0). Aktifkan setelah harga diisi lewat Master Treatment.');

  const homeCount = rows.filter((row) => row.name.includes('(HOME)')).length;
  const smootingZero = rows.filter((row) => row.name.startsWith('Smooting') && row.fee === 0).length;
  const profhilo = rows.find((row) => row.name === 'Skin Booster Profhilo')?.doctorFee;
  const hifuUpper = rows.find((row) => row.name === 'HIFU Upper Face')?.doctorFee;
  const exactMapped = built.filter((row) => row.mappingStatus === 'EXACT_NAME').length;
  console.log('\nCek kriteria penerimaan:');
  console.log(`  Layanan HOME: ${homeCount} (harus 10)`);
  console.log(`  Smooting fee nol: ${smootingZero} (harus 3)`);
  console.log(`  Fee dokter Skin Booster Profhilo: ${profhilo} (harus 765000)`);
  console.log(`  Fee dokter HIFU Upper Face: ${hifuUpper} (harus 177500)`);
  console.log(`  Mapping eksak nama (Dermapen): ${exactMapped} (harus 3)`);

  const suspicious = flagSuspiciousNames(rows);
  if (suspicious.length > 0) {
    console.log(`\nNama yang mungkin typo (impor persis dari sumber, tanpa koreksi otomatis): ${suspicious.length}`);
    for (const name of suspicious) console.log(`  ? ${name}`);
  }

  if (dryRun) {
    console.log('\nContoh hasil (10 pertama):');
    for (const row of built.slice(0, 10)) {
      console.log(`  ${row.code} | ${row.category} | fee=${row.fee} | dokter=${row.doctorFee}`);
    }
    console.log('\nDry run selesai, tidak ada perubahan database.');
    return;
  }

  const result = await importTreatments(built);
  console.log('\n=== HASIL IMPOR ===');
  console.log(`Dibuat: ${result.created.length}`);
  console.log(`Diperbarui: ${result.updated.length}`);
  console.log(`Dilewati: ${result.skipped.length}`);
}

main()
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(() => prisma.$disconnect());
