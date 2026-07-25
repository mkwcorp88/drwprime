// Script: populate nomorRekamMedis from CSV into existing DRW Prime members
// Run: npx tsx scripts/populate_nomor_rm.ts
// After deployment, run this ONCE to link members to their AIDO MR numbers

import { PrismaClient } from '@prisma/client';

function normalizePhone(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-().]/g, '');
  if (cleaned.startsWith('+62')) cleaned = cleaned.substring(3);
  else if (cleaned.startsWith('62') && cleaned.length >= 10) cleaned = cleaned.substring(2);
  else if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  if (cleaned.length < 8 || cleaned.length > 13) return '';
  return '62' + cleaned;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === ';' && !inQuotes) { result.push(current.trim()); current = ''; }
    else current += char;
  }
  result.push(current.trim());
  return result;
}

async function main() {
  const csvPath = process.argv[2] || '/mnt/c/Users/DRW/Downloads/pasien_drw_prime.csv';

  console.log(`Reading: ${csvPath}`);
  const fs = await import('fs');
  const text = fs.readFileSync(csvPath, 'utf-8');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 3) { console.log('File must have header + data'); process.exit(1); }

  // Skip "sep=;" line if present
  const startIdx = lines[0].startsWith('sep=') ? 1 : 0;
  const headers = lines[startIdx].split(';').map(h => h.trim().toLowerCase().replace(/[\s"]/g, ''));

  const colPhone = headers.findIndex(h => h === 'whatsapp' || h === 'phone' || h === 'nohp' || h === 'telepon');
  const colMR = headers.findIndex(h => h === 'norm' || h === 'nomr' || h === 'no_rm' || h === 'nomorrm');

  if (colPhone < 0 || colMR < 0) {
    console.log('Columns not found. Headers:', headers);
    process.exit(1);
  }

  console.log(`Found columns: phone at [${colPhone}], nomor_rm at [${colMR}]`);

  const prisma = new PrismaClient();
  await prisma.$connect();
  console.log('Database connected.');

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (let i = startIdx + 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    const rawPhone = cells[colPhone]?.trim() || '';
    const mrNumber = cells[colMR]?.trim() || '';

    if (!rawPhone || !mrNumber) continue;

    const normalizedPhone = normalizePhone(rawPhone);
    if (!normalizedPhone) continue;

    // Find member by phone
    const user = await prisma.user.findUnique({ where: { phone: normalizedPhone } });

    if (user) {
      if (user.nomorRekamMedis) {
        skipped++;
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: { nomorRekamMedis: mrNumber },
        });
        updated++;
        console.log(`Updated: ${user.firstName} → MR: ${mrNumber}`);
      }
    } else {
      notFound++;
      if (notFound <= 10) console.log(`Not found: phone=${normalizedPhone}, name=${cells[3]}, MR=${mrNumber}`);
    }
  }

  console.log(`\nDone: ${updated} updated, ${skipped} already set, ${notFound} not found`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
