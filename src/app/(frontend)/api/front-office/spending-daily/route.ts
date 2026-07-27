import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/prisma';

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

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9,.-]/g, '').replace(',', '.');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
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
      const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function startOfDay(input: Date): Date {
  const date = new Date(input);
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date');

    let range: { gte: Date; lt: Date } | undefined;
    if (dateParam) {
      const selectedDate = parseDateValue(dateParam);
      if (!selectedDate) {
        return NextResponse.json({ error: 'Format tanggal tidak valid' }, { status: 400 });
      }

      const from = startOfDay(selectedDate);
      const to = new Date(from);
      to.setDate(to.getDate() + 1);
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
      take: 1500,
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
    const scanWhere = range ? { spendingDate: range } : {};
    const scanRows = await prisma.spendingRecord.findMany({
      where: scanWhere,
      orderBy: { spendingDate: 'desc' },
      take: 500,
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

    const customerSummaries = Array.from(summaryMap.values())
      .sort((a, b) => b.totalPendapatan - a.totalPendapatan)
      .slice(0, 100);

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

    const totals = summariesWithMember.reduce(
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
      scanRecords,
      selectedDate: dateParam,
    });
  } catch (error) {
    console.error('[FO SPENDING DAILY] GET error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data spending harian' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
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

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const nomorInvoice = String(row.getCell(colNomorInvoice).value ?? '').trim();
      const namaPasien = String(row.getCell(colNamaPasien).value ?? '').trim();
      if (!nomorInvoice || !namaPasien) continue;

      const dateValue = row.getCell(colTanggalKunjungan).value;
      const parsedDate = parseDateValue(
        typeof dateValue === 'object' && dateValue && 'text' in dateValue ? dateValue.text : dateValue
      );
      if (!parsedDate) continue;

      parsedRows.push({
        nomorInvoice,
        nomorRegistrasi: colNomorRegistrasi ? String(row.getCell(colNomorRegistrasi).value ?? '').trim() || null : null,
        namaPasien,
        dob: colDob ? String(row.getCell(colDob).value ?? '').trim() || null : null,
        tanggalKunjungan: startOfDay(parsedDate),
        dokter: colDokter ? String(row.getCell(colDokter).value ?? '').trim() || null : null,
        diagnosa: colDiagnosa ? String(row.getCell(colDiagnosa).value ?? '').trim() || null : null,
        status: colStatus ? String(row.getCell(colStatus).value ?? '').trim() || null : null,
        totalPendapatan: toNumber(row.getCell(colTotalPendapatan).value),
        pendapatanTindakan: colPendapatanTindakan ? toNumber(row.getCell(colPendapatanTindakan).value) : 0,
        pendapatanObat: colPendapatanObat ? toNumber(row.getCell(colPendapatanObat).value) : 0,
        keuntungan: colKeuntungan ? toNumber(row.getCell(colKeuntungan).value) : 0,
      });
    }

    if (parsedRows.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada data valid yang bisa diproses dari file ini' },
        { status: 400 }
      );
    }

    // --- MEMBER MATCHING ---
    // Collect all unique patient names
    const uniqueNames = [...new Set(parsedRows.map(r => r.namaPasien.trim()))];
    
    // Find matching members by name (case-insensitive)
    const matchedMembers: Map<string, { id: string; firstName: string; lastName: string | null; phone: string | null }[]> = new Map();
    
    for (const name of uniqueNames) {
      const nameLower = name.toLowerCase();
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { firstName: { contains: name, mode: 'insensitive' } },
            { lastName: { contains: name, mode: 'insensitive' } },
          ],
        },
        select: { id: true, firstName: true, lastName: true, phone: true },
        take: 20,
      });
      
      // Filter: must match full name (both first+last combined)
      const matched = users.filter(u => {
        const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ').toLowerCase();
        return fullName.includes(nameLower) || nameLower.includes(fullName);
      });
      
      if (matched.length > 0) {
        matchedMembers.set(name, matched);
      }
    }

    // Create SpendingRecords for matched members & update totalSpending + points
    let linkedCount = 0;
    const needsConfirmation: { name: string; candidates: { id: string; firstName: string; lastName: string | null }[] }[] = [];
    let unmatchedCount = 0;
    const processedInvoices = new Set<string>();

    for (const row of parsedRows) {
      const matched = matchedMembers.get(row.namaPasien.trim());
      if (!matched || matched.length === 0) {
        unmatchedCount++;
        continue;
      }
      
      // Skip duplicate invoice
      const invoiceKey = `${row.nomorInvoice}_${row.namaPasien}`;
      if (processedInvoices.has(invoiceKey)) continue;
      processedInvoices.add(invoiceKey);

      if (matched.length > 1) {
        needsConfirmation.push({
          name: row.namaPasien,
          candidates: matched.map(m => ({ id: m.id, firstName: m.firstName, lastName: m.lastName })),
        });
        continue;
      }

      const member = matched[0]; // Single match — auto-link
      
      try {
        await prisma.spendingRecord.create({
          data: {
            userId: member.id,
            amount: row.totalPendapatan,
            treatment: `Kunjungan ${row.tanggalKunjungan.toLocaleDateString('id-ID')}`,
            spendingDate: row.tanggalKunjungan,
            source: 'front_office',
          },
        });

        const pointsEarned = Math.floor(row.totalPendapatan / 10000);
        
        await prisma.user.update({
          where: { id: member.id },
          data: {
            totalSpending: { increment: row.totalPendapatan },
            points: { increment: pointsEarned },
            lastTransactionAt: new Date(),
          },
        });

        linkedCount++;
      } catch (err) {
        console.error(`Failed to link spending for ${row.namaPasien}:`, err);
      }
    }

    // --- END MEMBER MATCHING ---

    const reportDateInput = String(formData.get('reportDate') || '').trim();
    const reportDate = reportDateInput ? parseDateValue(reportDateInput) : parsedRows[0]?.tanggalKunjungan;

    if (!reportDate) {
      return NextResponse.json({ error: 'Tanggal report tidak valid' }, { status: 400 });
    }

    const totalPendapatan = parsedRows.reduce((sum, r) => sum + r.totalPendapatan, 0);
    const totalKeuntungan = parsedRows.reduce((sum, r) => sum + r.keuntungan, 0);
    const normalizedReportDate = startOfDay(reportDate);

    const upload = await prisma.$transaction(async (tx) => {
      // Jika sudah ada upload untuk tanggal yang sama → hapus dulu (replace, bukan duplikat)
      const existingUploads = await tx.dailySpendingUpload.findMany({
        where: {
          reportDate: normalizedReportDate,
        },
        select: { id: true },
      });

      if (existingUploads.length > 0) {
        await tx.dailySpendingUpload.deleteMany({
          where: { reportDate: normalizedReportDate },
        });
      }

      const isReplace = existingUploads.length > 0;

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

      return { ...createdUpload, isReplace };
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
        linked: linkedCount,
        needsConfirmation: needsConfirmation.length > 0 ? needsConfirmation : undefined,
        unmatched: unmatchedCount,
      },
    });
  } catch (error) {
    console.error('[FO SPENDING DAILY] POST error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat upload report spending daily' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const all = searchParams.get('all') === 'true';

    if (all) {
      // Hapus semua riwayat upload (entri ikut terhapus via cascade)
      const result = await prisma.dailySpendingUpload.deleteMany({});
      return NextResponse.json({
        success: true,
        deletedCount: result.count,
        message: `Semua riwayat upload dihapus (${result.count} upload).`,
      });
    }

    if (!id) {
      return NextResponse.json({ error: 'Parameter id wajib diisi' }, { status: 400 });
    }

    const existing = await prisma.dailySpendingUpload.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Upload tidak ditemukan' }, { status: 404 });
    }

    // Entri terhapus otomatis via onDelete: Cascade
    await prisma.dailySpendingUpload.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Upload berhasil dihapus.',
    });
  } catch (error) {
    console.error('[FO SPENDING DAILY] DELETE error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menghapus data spending daily' },
      { status: 500 }
    );
  }
}
