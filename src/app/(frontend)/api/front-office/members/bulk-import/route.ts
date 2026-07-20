import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { isUserAdmin } from '@/lib/admin';
import { randomUUID } from 'crypto';
import ExcelJS from 'exceljs';

type ImportRow = {
  row: number;
  phone: string;
  firstName: string;
  lastName: string | null;
};

type ImportResult = {
  row: number;
  phone: string;
  firstName: string;
  lastName: string | null;
  status: 'created' | 'skipped_duplicate_in_file' | 'skipped_already_exists' | 'error';
  message: string;
};

function normalizeHeader(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str = '';
  if (typeof value === 'object' && value && 'text' in value) {
    str = String((value as { text: unknown }).text);
  } else {
    str = String(value);
  }
  return str
    .toLowerCase()
    .replace(/[\s\-_]+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function parseCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && value) {
    if ('text' in value && typeof (value as { text: unknown }).text === 'string') {
      const richText = value as { text: string };
      if (richText.text) return richText.text;
    }
    if ('toString' in value && typeof (value as Record<string, unknown>).toString === 'function') {
      return String(value);
    }
    return String(value);
  }
  return String(value).trim();
}

function normalizePhoneForImport(phone: string): string {
  let cleaned = phone.trim().replace(/[\s\-\(\)\.\+\/]/g, '');
  cleaned = cleaned.replace(/\D/g, '');
  if (cleaned.startsWith('62') && cleaned.length >= 10) return cleaned;
  if (cleaned.startsWith('0')) cleaned = '62' + cleaned.substring(1);
  else if (cleaned.startsWith('8')) cleaned = '62' + cleaned;
  if (!cleaned.match(/^62\d{9,13}$/)) return '';
  return cleaned;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function getCSVWorksheet(csvText: string): ExcelJS.Worksheet {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Import');
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  for (let i = 0; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    for (let j = 0; j < cells.length; j++) {
      ws.getCell(i + 1, j + 1).value = cells[j];
    }
  }
  return ws;
}

async function processImport(worksheet: ExcelJS.Worksheet, userId: string | null) {
  const headerRow = worksheet.getRow(1);
  const headerMap = new Map<string, number>();

  for (let col = 1; col <= headerRow.cellCount; col += 1) {
    const normalized = normalizeHeader(headerRow.getCell(col).value);
    if (normalized) headerMap.set(normalized, col);
  }

  const getColumn = (names: string[]): number | null => {
    for (const name of names) {
      const col = headerMap.get(normalizeHeader(name));
      if (col) return col;
    }
    return null;
  };

  const colPhone = getColumn(['Phone', 'Nomor HP', 'No HP', 'Telepon', 'No Telepon', 'Phone Number', 'WhatsApp', 'No WA', 'Nomor WhatsApp', 'HP']);
  const colFirstName = getColumn(['First Name', 'Nama Depan', 'Nama', 'Name', 'Nama Lengkap', 'Nama Pasien', 'First Name', 'FirstName']);
  const colLastName = getColumn(['Last Name', 'Nama Belakang', 'LastName', 'Last Name']);

  if (!colPhone) {
    return { error: 'Kolom "Phone" / "Nomor HP" tidak ditemukan di file. Pastikan file memiliki header kolom yang sesuai.' };
  }

  if (!colFirstName) {
    return { error: 'Kolom "Nama" / "First Name" tidak ditemukan di file.' };
  }

  const parsedRows: ImportRow[] = [];

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const rawPhone = parseCellValue(row.getCell(colPhone).value);
    const rawFirstName = parseCellValue(row.getCell(colFirstName).value);
    const rawLastName = colLastName ? parseCellValue(row.getCell(colLastName).value) : '';

    if (!rawPhone && !rawFirstName) continue;

    const phone = normalizePhoneForImport(rawPhone);
    const firstName = rawFirstName.trim();
    const lastName = rawLastName.trim() || null;

    if (!phone) continue;

    parsedRows.push({ row: rowNumber, phone, firstName, lastName });
  }

  if (parsedRows.length === 0) {
    return { error: 'Tidak ada data valid ditemukan di file. Pastikan kolom Phone dan Nama terisi.' };
  }

  const results: ImportResult[] = [];
  let createdCount = 0;
  let skippedDuplicateInFile = 0;
  let skippedAlreadyExists = 0;
  let errorCount = 0;
  const seenPhones = new Set<string>();

  for (const item of parsedRows) {
    if (seenPhones.has(item.phone)) {
      results.push({
        row: item.row,
        phone: item.phone,
        firstName: item.firstName,
        lastName: item.lastName,
        status: 'skipped_duplicate_in_file',
        message: 'Duplikat dalam file (nomor HP muncul lebih dari sekali)',
      });
      skippedDuplicateInFile++;
      continue;
    }
    seenPhones.add(item.phone);

    const existingMember = await prisma.user.findUnique({
      where: { phone: item.phone },
      select: { id: true, firstName: true, hasAccount: true },
    });

    if (existingMember) {
      results.push({
        row: item.row,
        phone: item.phone,
        firstName: item.firstName,
        lastName: item.lastName,
        status: 'skipped_already_exists',
        message: `Member sudah ada${existingMember.firstName ? ': ' + existingMember.firstName : ''}${existingMember.hasAccount ? ' (punya akun)' : ' (walk-in)'}`,
      });
      skippedAlreadyExists++;
      continue;
    }

    if (!item.firstName) {
      results.push({
        row: item.row,
        phone: item.phone,
        firstName: '-',
        lastName: item.lastName,
        status: 'error',
        message: 'Nama depan wajib diisi',
      });
      errorCount++;
      continue;
    }

    try {
      await prisma.user.create({
        data: {
          phone: item.phone,
          firstName: item.firstName,
          lastName: item.lastName,
          hasAccount: false,
          qrToken: randomUUID(),
        },
      });

      results.push({
        row: item.row,
        phone: item.phone,
        firstName: item.firstName,
        lastName: item.lastName,
        status: 'created',
        message: 'Member baru berhasil dibuat',
      });
      createdCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      results.push({
        row: item.row,
        phone: item.phone,
        firstName: item.firstName,
        lastName: item.lastName,
        status: 'error',
        message: `Gagal: ${msg.substring(0, 100)}`,
      });
      errorCount++;
      seenPhones.delete(item.phone);
    }
  }

  return {
    success: true,
    summary: {
      total: parsedRows.length,
      created: createdCount,
      skippedDuplicateInFile,
      skippedAlreadyExists,
      errors: errorCount,
    },
    results,
  };
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isUserAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await auth();
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File wajib diupload' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const isCsv = fileName.endsWith('.csv');
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (!isExcel && !isCsv) {
      return NextResponse.json(
        { error: 'Format file tidak didukung. Gunakan .xlsx, .xls, atau .csv' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let worksheet: ExcelJS.Worksheet;

    if (isCsv) {
      const csvText = buffer.toString('utf-8');
      worksheet = getCSVWorksheet(csvText);
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
      worksheet = workbook.worksheets[0];
      if (!worksheet) {
        return NextResponse.json({ error: 'Sheet tidak ditemukan di file Excel' }, { status: 400 });
      }
    }

    const result = await processImport(worksheet, userId);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[BULK-IMPORT] Error:', error);
    return NextResponse.json(
      {
        error: 'Gagal memproses file import',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
