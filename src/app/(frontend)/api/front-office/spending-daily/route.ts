import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';
import { isAidoManagedSpendingDate } from '@/lib/aido/config';

type ParsedRow = {
  nomorInvoice: string;
  nomorRegistrasi: string | null;
  namaPasien: string;
  dob: string | null;
  tanggalKunjungan: Date;
  dokter: string | null;
  diagnosa: string | null;
  status: string | null;
  totalPendapatan: number;
  pendapatanTindakan: number;
  pendapatanObat: number;
  keuntungan: number;
};

type LinkedDailyRow = {
  row: ParsedRow;
  memberId: string;
  externalId: string;
  pointsEarned: number;
};

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID');
}

function sameDate(left: Date | null, right: Date | null): boolean {
  return Boolean(left && right)
    && left!.toISOString().slice(0, 10) === right!.toISOString().slice(0, 10);
}

function tierForSpending(totalSpending: number): 'Bronze' | 'Silver' | 'Gold' | 'Platinum' {
  if (totalSpending >= 10_000_000) return 'Platinum';
  if (totalSpending >= 5_000_000) return 'Gold';
  if (totalSpending >= 1_000_000) return 'Silver';
  return 'Bronze';
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const compact = value.trim().replace(/[^0-9,.-]/g, '');
    if (!compact) return null;
    const commaCount = (compact.match(/,/g) || []).length;
    const dotCount = (compact.match(/\./g) || []).length;
    let normalized = compact;
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
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseDateValue(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'number') {
    // Excel serial date to JS date (UTC-based)
    const excelEpoch = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpoch + value * 86400000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const ddmmyyyy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;
    const match = trimmed.match(ddmmyyyy);

    if (match) {
      const [, dd, mm, yyyy] = match;
      const day = Number(dd);
      const month = Number(mm);
      const year = Number(yyyy);
      const check = new Date(Date.UTC(year, month - 1, day));
      if (
        check.getUTCFullYear() !== year
        || check.getUTCMonth() !== month - 1
        || check.getUTCDate() !== day
      ) return null;
      const date = new Date(Date.UTC(year, month - 1, day));
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function parseDobValue(value: string): Date | null {
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const date = new Date(`${trimmed}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== trimmed) return null;
    return date;
  }
  const indonesia = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (indonesia) {
    const [, day, month, year] = indonesia;
    const date = new Date(
      `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`,
    );
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`) {
      return null;
    }
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return parseDateValue(value);
}

function startOfJakartaDay(input: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(input);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return new Date(`${values.year}-${values.month}-${values.day}T00:00:00+07:00`);
}

function formatJakartaDate(input: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(input);
}

async function recomputeLastTransactionAt(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  const [spending, reservation] = await Promise.all([
    tx.spendingRecord.findFirst({
      where: { userId },
      orderBy: { spendingDate: 'desc' },
      select: { spendingDate: true },
    }),
    tx.reservation.findFirst({
      where: { userId, status: 'completed', completedAt: { not: null } },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    }),
  ]);
  const dates = [spending?.spendingDate, reservation?.completedAt]
    .filter((date): date is Date => Boolean(date));
  await tx.user.update({
    where: { id: userId },
    data: {
      lastTransactionAt: dates.length > 0
        ? new Date(Math.max(...dates.map((date) => date.getTime())))
        : null,
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date');

    let range: { gte: Date; lt: Date } | undefined;
    if (dateParam) {
      const selectedDate = parseDateValue(dateParam);
      if (!selectedDate) {
        return NextResponse.json({ error: 'Format tanggal tidak valid' }, { status: 400 });
      }

       const from = startOfJakartaDay(selectedDate);
       const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
      range = { gte: from, lt: to };
    }

    const whereByDate = range ? { tanggalKunjungan: range } : {};

    const uploads = await prisma.dailySpendingUpload.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        _count: { select: { entries: true } },
      },
    });

    const entries = await prisma.dailySpendingEntry.findMany({
      where: whereByDate,
      orderBy: { tanggalKunjungan: 'desc' },
      select: {
        namaPasien: true,
        tanggalKunjungan: true,
        totalPendapatan: true,
        keuntungan: true,
      },
    });

    const summaryMap = new Map<string, {
      namaPasien: string;
      totalKunjungan: number;
      totalPendapatan: number;
      totalKeuntungan: number;
      lastVisit: Date;
    }>();

    for (const row of entries) {
      const key = row.namaPasien.trim().toLowerCase();
      const current = summaryMap.get(key);
      const pendapatan = Number(row.totalPendapatan || 0);
      const keuntungan = Number(row.keuntungan || 0);

      if (!current) {
        summaryMap.set(key, {
          namaPasien: row.namaPasien,
          totalKunjungan: 1,
          totalPendapatan: pendapatan,
          totalKeuntungan: keuntungan,
          lastVisit: row.tanggalKunjungan,
        });
        continue;
      }

      current.totalKunjungan += 1;
      current.totalPendapatan += pendapatan;
      current.totalKeuntungan += keuntungan;
      if (row.tanggalKunjungan > current.lastVisit) {
        current.lastVisit = row.tanggalKunjungan;
      }
    }

    // Data hasil SCAN (sumber utama / real-time) — ikut digabung ke ringkasan
    const scanWhere = range
      ? { spendingDate: range, source: 'scan' }
      : { source: 'scan' };
    const aidoWhere = {
      ...(range ? { transactionDate: range } : {}),
      ...(process.env.AIDO_HOSPITAL_ID?.trim()
        ? { hospitalId: process.env.AIDO_HOSPITAL_ID.trim() }
        : {}),
    };
    const aidoRows = await prisma.aidoIncomeRecord.findMany({
      where: aidoWhere,
      orderBy: { transactionDate: 'desc' },
      select: {
        id: true,
        patientName: true,
        treatment: true,
        amount: true,
        transactionDate: true,
        matchStatus: true,
        matchedUserId: true,
      },
    });

    for (const income of aidoRows) {
      const namaPasien = income.patientName?.trim() || 'Pasien AIDO';
      const key = namaPasien.toLowerCase();
      const pendapatan = Number(income.amount);
      const current = summaryMap.get(key);
      if (!current) {
        summaryMap.set(key, {
          namaPasien,
          totalKunjungan: 1,
          totalPendapatan: pendapatan,
          totalKeuntungan: 0,
          lastVisit: income.transactionDate,
        });
      } else {
        current.totalKunjungan += 1;
        current.totalPendapatan += pendapatan;
        if (income.transactionDate > current.lastVisit) {
          current.lastVisit = income.transactionDate;
        }
      }
    }

    const scanRows = await prisma.spendingRecord.findMany({
      where: scanWhere,
      orderBy: { spendingDate: 'desc' },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    const scanRecords = scanRows.map((s) => ({
      id: s.id,
      namaPasien: [s.user.firstName, s.user.lastName].filter(Boolean).join(' ') || 'Member',
      treatment: s.treatment,
      amount: Number(s.amount),
      spendingDate: s.spendingDate,
    }));

    for (const s of scanRecords) {
      const key = s.namaPasien.trim().toLowerCase();
      const current = summaryMap.get(key);
      if (!current) {
        summaryMap.set(key, {
          namaPasien: s.namaPasien,
          totalKunjungan: 1,
          totalPendapatan: s.amount,
          totalKeuntungan: 0,
          lastVisit: s.spendingDate,
        });
      } else {
        current.totalKunjungan += 1;
        current.totalPendapatan += s.amount;
        if (s.spendingDate > current.lastVisit) {
          current.lastVisit = s.spendingDate;
        }
      }
    }

    const allCustomerSummaries = Array.from(summaryMap.values())
      .sort((a, b) => b.totalPendapatan - a.totalPendapatan)
    const customerSummaries = allCustomerSummaries.slice(0, 100);

    // Cari member yang cocok untuk setiap customer summary
    const customerNames = customerSummaries.map(s => s.namaPasien.trim());
    const linkedUsers = await prisma.user.findMany({
      where: {
        OR: customerNames.flatMap(name => [
          { firstName: { contains: name, mode: 'insensitive' as const } },
          { lastName: { contains: name, mode: 'insensitive' as const } },
        ]),
      },
      select: { id: true, firstName: true, lastName: true, phone: true, totalSpending: true, points: true, nomorRekamMedis: true },
      take: 200,
    });

    const summariesWithMember = customerSummaries.map(s => {
      const nameLower = s.namaPasien.toLowerCase();
      const linked = linkedUsers.filter(u => {
        const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ').toLowerCase();
        return fullName.includes(nameLower) || nameLower.includes(fullName);
      });
      return {
        ...s,
        linkedMember: linked.length === 1 ? {
          id: linked[0].id,
          firstName: linked[0].firstName,
          lastName: linked[0].lastName,
          phone: linked[0].phone,
          totalSpending: Number(linked[0].totalSpending),
          points: linked[0].points,
          nomorRekamMedis: linked[0].nomorRekamMedis,
        } : linked.length > 1 ? { multiple: true, count: linked.length } : null,
      };
    });

    const totals = allCustomerSummaries.reduce(
      (acc, item) => {
        acc.totalPendapatan += item.totalPendapatan;
        acc.totalKeuntungan += item.totalKeuntungan;
        acc.totalKunjungan += item.totalKunjungan;
        return acc;
      },
      { totalPendapatan: 0, totalKeuntungan: 0, totalKunjungan: 0 }
    );

    return NextResponse.json({
      uploads: uploads.map((u) => ({
        id: u.id,
        reportDate: u.reportDate,
        sourceFileName: u.sourceFileName,
        totalRows: u.totalRows,
        totalPendapatan: Number(u.totalPendapatan),
        totalKeuntungan: Number(u.totalKeuntungan),
        createdAt: u.createdAt,
        uploadedByClerkId: u.uploadedByClerkId,
        entryCount: u._count.entries,
      })),
      customerSummaries: summariesWithMember,
      totals,
      summaryCount: allCustomerSummaries.length,
      scanRecords,
      aidoRecords: aidoRows.map((income) => ({
        id: income.id,
        namaPasien: income.patientName || 'Pasien AIDO',
        treatment: income.treatment,
        amount: Number(income.amount),
        transactionDate: income.transactionDate,
        matchStatus: income.matchStatus,
        matchedUserId: income.matchedUserId,
      })),
      aidoSummary: {
        totalRows: aidoRows.length,
        totalPendapatan: aidoRows.reduce((sum, income) => sum + Number(income.amount), 0),
        matchedRows: aidoRows.filter((income) => income.matchStatus === 'MATCHED').length,
        unmatchedRows: aidoRows.filter((income) => income.matchStatus !== 'MATCHED').length,
      },
      selectedDate: dateParam,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[FO SPENDING DAILY] GET error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data spending harian' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const { userId } = await auth();
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File Excel wajib diupload' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json({ error: 'File harus berformat .xlsx' }, { status: 400 });
    }

    const workbook = new ExcelJS.Workbook();
    const buffer = Buffer.from(await file.arrayBuffer());
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

    const worksheet = workbook.getWorksheet('Kunjungan') || workbook.worksheets[0];
    if (!worksheet) {
      return NextResponse.json({ error: 'Sheet tidak ditemukan di file Excel' }, { status: 400 });
    }

    const headerRow = worksheet.getRow(1);
    const headerMap = new Map<string, number>();

    for (let col = 1; col <= headerRow.cellCount; col += 1) {
      const cellValue = headerRow.getCell(col).value;
      const normalized = normalizeHeader(
        typeof cellValue === 'object' && cellValue && 'text' in cellValue
          ? cellValue.text
          : cellValue
      );
      if (normalized) {
        headerMap.set(normalized, col);
      }
    }

    const getColumn = (name: string): number | null => headerMap.get(normalizeHeader(name)) ?? null;

    const colNomorInvoice = getColumn('Nomor Invoice');
    const colNomorRegistrasi = getColumn('Nomor Registrasi');
    const colNamaPasien = getColumn('Nama Pasien');
    const colDob = getColumn('DOB');
    const colTanggalKunjungan = getColumn('Tanggal Kunjungan');
    const colDokter = getColumn('Dokter');
    const colDiagnosa = getColumn('Diagnosa');
    const colTotalPendapatan = getColumn('Total Pendapatan');
    const colPendapatanTindakan = getColumn('Pendapatan Tindakan');
    const colPendapatanObat = getColumn('Pendapatan Obat');
    const colKeuntungan = getColumn('Keutungan') ?? getColumn('Keuntungan');
    const colStatus = getColumn('Status');

    if (!colNomorInvoice || !colNamaPasien || !colTanggalKunjungan || !colTotalPendapatan) {
      return NextResponse.json(
        { error: 'Format file tidak sesuai. Pastikan kolom utama tersedia.' },
        { status: 400 }
      );
    }

    const parsedRows: ParsedRow[] = [];
    let invalidRows = 0;

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const nomorInvoice = String(row.getCell(colNomorInvoice).value ?? '').trim();
      const namaPasien = String(row.getCell(colNamaPasien).value ?? '').trim();
      if (!nomorInvoice || !namaPasien) {
        invalidRows += 1;
        continue;
      }

      const dateValue = row.getCell(colTanggalKunjungan).value;
      const parsedDate = parseDateValue(
        typeof dateValue === 'object' && dateValue && 'text' in dateValue ? dateValue.text : dateValue
      );
      const dob = colDob ? String(row.getCell(colDob).value ?? '').trim() || null : null;
      const parsedDob = dob ? parseDobValue(dob) : null;
      const totalPendapatan = toNumber(row.getCell(colTotalPendapatan).value);
      const pendapatanTindakan = colPendapatanTindakan
        ? toNumber(row.getCell(colPendapatanTindakan).value)
        : 0;
      const pendapatanObat = colPendapatanObat
        ? toNumber(row.getCell(colPendapatanObat).value)
        : 0;
      const keuntungan = colKeuntungan
        ? toNumber(row.getCell(colKeuntungan).value)
        : 0;
      if (
        !parsedDate
        || Boolean(dob && !parsedDob)
        || totalPendapatan === null
        || totalPendapatan < 0
        || pendapatanTindakan === null
        || pendapatanObat === null
        || keuntungan === null
      ) {
        invalidRows += 1;
        continue;
      }

      parsedRows.push({
        nomorInvoice,
        nomorRegistrasi: colNomorRegistrasi ? String(row.getCell(colNomorRegistrasi).value ?? '').trim() || null : null,
        namaPasien,
        dob,
        tanggalKunjungan: startOfJakartaDay(parsedDate),
        dokter: colDokter ? String(row.getCell(colDokter).value ?? '').trim() || null : null,
        diagnosa: colDiagnosa ? String(row.getCell(colDiagnosa).value ?? '').trim() || null : null,
        status: colStatus ? String(row.getCell(colStatus).value ?? '').trim() || null : null,
        totalPendapatan,
        pendapatanTindakan,
        pendapatanObat,
        keuntungan,
      });
    }

    if (parsedRows.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada data valid yang bisa diproses dari file ini' },
        { status: 400 }
      );
    }
    if (invalidRows > 0) {
      return NextResponse.json(
        { error: 'File mengandung baris dengan tanggal atau nominal tidak valid.', invalidRows },
        { status: 400 },
      );
    }
    if (parsedRows.some((row) => isAidoManagedSpendingDate(row.tanggalKunjungan))) {
      return NextResponse.json(
        { error: 'Laporan setelah cutover disinkronkan otomatis dari AIDO.' },
        { status: 409 }
      );
    }

    const reportDateInput = String(formData.get('reportDate') || '').trim();
    const reportDate = reportDateInput ? parseDateValue(reportDateInput) : parsedRows[0]?.tanggalKunjungan;
    if (!reportDate) {
      return NextResponse.json({ error: 'Tanggal report tidak valid' }, { status: 400 });
    }
    const normalizedReportDate = startOfJakartaDay(reportDate);
    if (isAidoManagedSpendingDate(normalizedReportDate)) {
      return NextResponse.json(
        { error: 'Report setelah cutover disinkronkan otomatis dari AIDO.' },
        { status: 409 },
      );
    }
    const reportDateKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(normalizedReportDate);

    // --- MEMBER MATCHING ---
    // Collect all unique patient names
    const uniqueNames = [...new Set(parsedRows.map(r => r.namaPasien.trim()))];
    
    // Find matching members by name (case-insensitive)
    const matchedMembers: Map<string, {
      id: string;
      firstName: string;
      lastName: string | null;
      phone: string | null;
      dateOfBirth: Date | null;
    }[]> = new Map();
    
    for (const name of uniqueNames) {
      const nameLower = normalizeName(name);
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { firstName: { contains: name, mode: 'insensitive' } },
            { lastName: { contains: name, mode: 'insensitive' } },
          ],
        },
        select: { id: true, firstName: true, lastName: true, phone: true, dateOfBirth: true },
        take: 20,
      });
      
      // Filter: must match full name (both first+last combined)
      const matched = users.filter(u => {
        const fullName = normalizeName([u.firstName, u.lastName].filter(Boolean).join(' '));
        return fullName === nameLower;
      });
      
      if (matched.length > 0) {
        matchedMembers.set(name, matched);
      }
    }

    const linkedRows: LinkedDailyRow[] = [];
    const needsConfirmation: { name: string; candidates: { id: string; firstName: string; lastName: string | null }[] }[] = [];
    let unmatchedCount = 0;
    const processedInvoices = new Set<string>();
    let duplicateInvoices = 0;

    for (const row of parsedRows) {
      const matched = matchedMembers.get(row.namaPasien.trim());
      if (!matched || matched.length === 0) {
        unmatchedCount++;
        continue;
      }
      
      // Skip duplicate invoice
      const invoiceKey = row.nomorInvoice;
      if (processedInvoices.has(invoiceKey)) {
        duplicateInvoices += 1;
        continue;
      }
      processedInvoices.add(invoiceKey);

      const rowDob = row.dob ? parseDobValue(row.dob) : null;
      const eligible = rowDob
        ? matched.filter((candidate) => sameDate(candidate.dateOfBirth, rowDob))
        : [];
      if (eligible.length === 0) {
        needsConfirmation.push({
          name: row.namaPasien,
          candidates: matched.map(m => ({ id: m.id, firstName: m.firstName, lastName: m.lastName })),
        });
        continue;
      }
      if (eligible.length > 1) {
        needsConfirmation.push({
          name: row.namaPasien,
          candidates: eligible.map(m => ({ id: m.id, firstName: m.firstName, lastName: m.lastName })),
        });
        continue;
      }

      const member = eligible[0];
      const externalId = `daily:${reportDateKey}:${row.nomorInvoice}`;
      const pointsEarned = Math.floor(row.totalPendapatan / 10000);
      linkedRows.push({ row, memberId: member.id, externalId, pointsEarned });
    }

    if (duplicateInvoices > 0) {
      return NextResponse.json(
        { error: 'Nomor invoice duplikat ditemukan; upload dibatalkan.', duplicateInvoices },
        { status: 400 },
      );
    }

    // --- END MEMBER MATCHING ---

    const totalPendapatan = parsedRows.reduce((sum, r) => sum + r.totalPendapatan, 0);
    const totalKeuntungan = parsedRows.reduce((sum, r) => sum + r.keuntungan, 0);

    const upload = await prisma.$transaction(async (tx) => {
      const existingUploads = await tx.dailySpendingUpload.findMany({
        where: {
          reportDate: normalizedReportDate,
        },
        select: { id: true },
      });
      const existingRecords = await tx.spendingRecord.findMany({
        where: {
          source: 'daily-import',
          externalId: { startsWith: `daily:${reportDateKey}:` },
        },
        select: { id: true, userId: true, amount: true, pointsEarned: true },
      });
      const reversedByUser = new Map<string, { amount: number; points: number }>();
      for (const record of existingRecords) {
        const current = reversedByUser.get(record.userId) || { amount: 0, points: 0 };
        current.amount += Number(record.amount);
        current.points += record.pointsEarned;
        reversedByUser.set(record.userId, current);
      }

      if (existingRecords.length > 0) {
        await tx.spendingRecord.deleteMany({
          where: { id: { in: existingRecords.map((record) => record.id) } },
        });
        for (const [userId, delta] of reversedByUser) {
          const user = await tx.user.findUniqueOrThrow({
            where: { id: userId },
            select: { totalSpending: true },
          });
          const totalSpending = Number(user.totalSpending) - delta.amount;
          if (totalSpending < 0) throw new Error('NEGATIVE_MEMBER_TOTAL');
          await tx.user.update({
            where: { id: userId },
            data: {
              totalSpending: { decrement: delta.amount },
              points: { decrement: delta.points },
              loyaltyLevel: tierForSpending(totalSpending),
            },
          });
          await recomputeLastTransactionAt(tx, userId);
        }
      }

      if (existingUploads.length > 0) {
        await tx.dailySpendingUpload.deleteMany({ where: { reportDate: normalizedReportDate } });
      }

      const isReplace = existingUploads.length > 0;

      let linkedCount = 0;
      for (const linked of linkedRows) {
        const current = await tx.user.findUniqueOrThrow({
          where: { id: linked.memberId },
          select: { totalSpending: true, lastTransactionAt: true },
        });
        const totalSpending = Number(current.totalSpending) + linked.row.totalPendapatan;
        await tx.spendingRecord.create({
          data: {
            userId: linked.memberId,
            amount: linked.row.totalPendapatan,
            treatment: `Kunjungan ${linked.row.tanggalKunjungan.toLocaleDateString('id-ID')}`,
            spendingDate: linked.row.tanggalKunjungan,
            source: 'daily-import',
            externalId: linked.externalId,
            pointsEarned: linked.pointsEarned,
          },
        });
        await tx.user.update({
          where: { id: linked.memberId },
          data: {
            totalSpending: { increment: linked.row.totalPendapatan },
            points: { increment: linked.pointsEarned },
            loyaltyLevel: tierForSpending(totalSpending),
            lastTransactionAt: !current.lastTransactionAt || linked.row.tanggalKunjungan > current.lastTransactionAt
              ? linked.row.tanggalKunjungan
              : undefined,
          },
        });
        linkedCount += 1;
      }

      const createdUpload = await tx.dailySpendingUpload.create({
        data: {
          reportDate: normalizedReportDate,
          sourceFileName: file.name,
          uploadedByClerkId: userId ?? null,
          totalRows: parsedRows.length,
          totalPendapatan,
          totalKeuntungan,
        },
      });

      await tx.dailySpendingEntry.createMany({
        data: parsedRows.map((row) => ({
          uploadId: createdUpload.id,
          nomorInvoice: row.nomorInvoice,
          nomorRegistrasi: row.nomorRegistrasi,
          namaPasien: row.namaPasien,
          dob: row.dob,
          tanggalKunjungan: row.tanggalKunjungan,
          dokter: row.dokter,
          diagnosa: row.diagnosa,
          status: row.status,
          totalPendapatan: row.totalPendapatan,
          pendapatanTindakan: row.pendapatanTindakan,
          pendapatanObat: row.pendapatanObat,
          keuntungan: row.keuntungan,
        })),
        skipDuplicates: true,
      });

      return { ...createdUpload, isReplace, linkedCount };
    });

    const message = upload.isReplace
      ? `Data tanggal ${normalizedReportDate.toLocaleDateString('id-ID')} diganti: ${upload.totalRows} baris diproses.`
      : `Report penjualan berhasil diupload: ${upload.totalRows} baris diproses.`;

    return NextResponse.json({
      success: true,
      message,
      isReplace: upload.isReplace,
      upload: {
        id: upload.id,
        reportDate: upload.reportDate,
        sourceFileName: upload.sourceFileName,
        totalRows: upload.totalRows,
        totalPendapatan: Number(upload.totalPendapatan),
        totalKeuntungan: Number(upload.totalKeuntungan),
        createdAt: upload.createdAt,
      },
      memberMatching: {
         linked: upload.linkedCount,
        needsConfirmation: needsConfirmation.length > 0 ? needsConfirmation : undefined,
        unmatched: unmatchedCount,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[FO SPENDING DAILY] POST error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat upload report spending daily' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const all = searchParams.get('all') === 'true';

    if (!all && !id) {
      return NextResponse.json({ error: 'Parameter id wajib diisi' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const uploads = all
        ? await tx.dailySpendingUpload.findMany({
            select: {
              id: true,
              reportDate: true,
              entries: { select: { nomorInvoice: true } },
            },
          })
        : await tx.dailySpendingUpload.findUnique({
            where: { id: id! },
            select: {
              id: true,
              reportDate: true,
              entries: { select: { nomorInvoice: true } },
            },
          }).then((upload) => upload ? [upload] : []);

      if (!all && uploads.length === 0) {
        throw new Error('UPLOAD_NOT_FOUND');
      }

      const externalIds = uploads.flatMap((upload) => {
        const dateKey = formatJakartaDate(upload.reportDate);
        return upload.entries.map((entry) => `daily:${dateKey}:${entry.nomorInvoice}`);
      });
      const records = externalIds.length > 0
        ? await tx.spendingRecord.findMany({
            where: { source: 'daily-import', externalId: { in: externalIds } },
            select: { id: true, userId: true, amount: true, pointsEarned: true },
          })
        : [];
      const byUser = new Map<string, { amount: number; points: number }>();
      for (const record of records) {
        const current = byUser.get(record.userId) || { amount: 0, points: 0 };
        current.amount += Number(record.amount);
        current.points += record.pointsEarned;
        byUser.set(record.userId, current);
      }

      if (records.length > 0) {
        await tx.spendingRecord.deleteMany({ where: { id: { in: records.map((record) => record.id) } } });
        for (const [userId, delta] of byUser) {
          const user = await tx.user.findUniqueOrThrow({
            where: { id: userId },
            select: { totalSpending: true },
          });
          const totalSpending = Number(user.totalSpending) - delta.amount;
          if (totalSpending < 0) throw new Error('NEGATIVE_MEMBER_TOTAL');
          await tx.user.update({
            where: { id: userId },
            data: {
              totalSpending: { decrement: delta.amount },
              points: { decrement: delta.points },
              loyaltyLevel: tierForSpending(totalSpending),
            },
          });
          await recomputeLastTransactionAt(tx, userId);
        }
      }

      const deleted = all
        ? await tx.dailySpendingUpload.deleteMany({})
        : await tx.dailySpendingUpload.delete({ where: { id: id! } }).then(() => ({ count: 1 }));
      return { uploads: deleted.count, records: records.length };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({
      success: true,
      deletedCount: result.uploads,
      reversedSpendingRecords: result.records,
      message: all
        ? `Semua riwayat upload dihapus (${result.uploads} upload).`
        : 'Upload berhasil dihapus.',
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    if (error instanceof Error && error.message === 'UPLOAD_NOT_FOUND') {
      return NextResponse.json({ error: 'Upload tidak ditemukan' }, { status: 404 });
    }
    console.error('[FO SPENDING DAILY] DELETE error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menghapus data spending daily' },
      { status: 500 }
    );
  }
}
