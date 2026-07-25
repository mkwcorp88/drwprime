import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

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
    } else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else current += char;
  }
  result.push(current.trim());
  return result;
}

type MemberRow = { phone: string; firstName: string; lastName: string | null };

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const csvPath = args.find(a => !a.startsWith('--')) || '/mnt/c/Users/DRW/Downloads/pasien_drw_prime_cleaned.csv';

  console.log(`Reading: ${csvPath}`);
  const text = fs.readFileSync(csvPath, 'utf-8');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) { console.log('File must have header + data'); process.exit(1); }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, ''));
  const colPhone = headers.indexOf('phone');
  const colFirst = headers.findIndex(h => h === 'firstname' || h === 'first_name');
  const colLast = headers.findIndex(h => h === 'lastname' || h === 'last_name');

  if (colPhone < 0 || colFirst < 0) { console.log('Columns not found. Headers:', headers); process.exit(1); }

  const rows: MemberRow[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    const phone = normalizePhone(cells[colPhone]?.trim() || '');
    const firstName = cells[colFirst]?.trim() || '';
    if (!phone || !firstName) continue;
    if (seen.has(phone)) continue;
    seen.add(phone);
    rows.push({ phone, firstName, lastName: colLast >= 0 ? cells[colLast]?.trim() || null : null });
  }

  console.log(`Parsed: ${rows.length} valid unique rows`);

  if (dryRun) {
    console.log('\n--- DRY RUN (first 10) ---');
    rows.slice(0, 10).forEach(r => console.log(`  ${r.phone} | ${r.firstName} ${r.lastName || ''}`));
    console.log(`... and ${rows.length - 10} more`);
    console.log('\nRun without --dry-run to execute.');
    process.exit(0);
  }

  const prisma = new PrismaClient();
  console.log('Connecting to database...');
  await prisma.$connect();

  const allPhones = rows.map(r => r.phone);

  // Batch check existing
  console.log(`Checking ${allPhones.length} phones against database...`);
  const existing = await prisma.user.findMany({
    where: { phone: { in: allPhones } },
    select: { phone: true },
  });
  const existingPhones = new Set(existing.map(u => u.phone!));
  const newRows = rows.filter(r => !existingPhones.has(r.phone));

  console.log(`Existing: ${existingPhones.size}, New to insert: ${newRows.length}`);

  if (newRows.length === 0) {
    console.log('All members already exist. Nothing to do.');
    await prisma.$disconnect();
    process.exit(0);
  }

  // Insert in batches of 100 using raw SQL for efficiency
  const BATCH = 100;
  let inserted = 0;
  const batches = [];
  for (let i = 0; i < newRows.length; i += BATCH) {
    batches.push(newRows.slice(i, i + BATCH));
  }

  for (const batch of batches) {
    try {
      const result = await prisma.user.createMany({
        data: batch.map(r => ({
          phone: r.phone,
          firstName: r.firstName,
          lastName: r.lastName,
          hasAccount: false,
          qrToken: randomUUID(),
        })),
        skipDuplicates: true,
      });
      inserted += result.count;
      console.log(`  Batch: ${result.count} inserted, total: ${inserted}/${newRows.length}`);
    } catch (err) {
      // Fallback: insert one by one
      console.log(`  Batch failed, falling back to individual inserts...`);
      for (const r of batch) {
        try {
          await prisma.user.create({
            data: {
              phone: r.phone,
              firstName: r.firstName,
              lastName: r.lastName,
              hasAccount: false,
              qrToken: randomUUID(),
            },
          });
          inserted++;
        } catch (e: any) {
          if (e?.code === 'P2002') {
            console.log(`  Skip (duplicate): ${r.phone}`);
          } else {
            console.log(`  Error: ${r.phone} - ${e?.message}`);
          }
        }
      }
      console.log(`  After fallback: ${inserted}/${newRows.length}`);
    }
  }

  console.log(`\nDONE: ${inserted} new members created, ${existingPhones.size} already existed, ${rows.length - existingPhones.size - inserted} failed`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
