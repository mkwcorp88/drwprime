import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, handleAuthError } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const VALID_RANGES = new Set(['7d', '30d']);

// --------------- helpers ---------------

function getJakartaDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addDays(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

interface DayResult {
  visits: number;
  omzet: number;
}

interface DayEntry {
  date: string;
  visit: DayResult;
  homeTreatment: DayResult;
}

function emptyResult(): DayResult {
  return { visits: 0, omzet: 0 };
}

function buildRangeKeys(endDateKey: string, days: number): string[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    keys.push(addDays(endDateKey, -i));
  }
  return keys;
}

function isHomeTreatment(treatment: string | null): boolean {
  const normalized = treatment?.toLocaleLowerCase('id-ID') || '';
  return /home\s*[- ]?treatment|home\s*[- ]?visit|kunjungan\s+rumah|homecare/.test(normalized);
}

function computeRange(
  rows: Array<{ syncDate: string; amount: unknown; treatment: string | null }>,
  targetDateKeys: Set<string>,
): Map<string, DayEntry> {
  const entries = new Map<string, DayEntry>();
  for (const dk of targetDateKeys) {
    entries.set(dk, { date: dk, visit: emptyResult(), homeTreatment: emptyResult() });
  }

  for (const row of rows) {
    const entry = entries.get(row.syncDate);
    if (!entry) continue;
    const result = isHomeTreatment(row.treatment) ? entry.homeTreatment : entry.visit;
    result.visits += 1;
    result.omzet += Number(row.amount);
  }

  return entries;
}

// --------------- main handler ---------------

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = req.nextUrl;
    const range = searchParams.get('range');
    const dateParam = searchParams.get('date') || getJakartaDateKey(new Date());

    if (!isValidDateKey(dateParam)) {
      return NextResponse.json({ error: 'Format tanggal harus YYYY-MM-DD.' }, { status: 400 });
    }

    if (range && !VALID_RANGES.has(range)) {
      return NextResponse.json({ error: 'range harus 7d atau 30d.' }, { status: 400 });
    }

    const todayKey = getJakartaDateKey(new Date());

    if (dateParam > todayKey) {
      return NextResponse.json({ error: 'Tidak dapat melihat tanggal yang belum terjadi.' }, { status: 400 });
    }

    const hospitalId = process.env.AIDO_HOSPITAL_ID?.trim();
    if (!hospitalId) {
      return NextResponse.json({ error: 'Sumber data AIDO belum dikonfigurasi.' }, { status: 503 });
    }

    const days = range === '30d' ? 30 : range === '7d' ? 7 : 1;
    const dateKeys = buildRangeKeys(dateParam, days);
    const rows = await prisma.aidoIncomeRecord.findMany({
      where: {
        hospitalId,
        syncDate: { in: dateKeys },
      },
      select: { syncDate: true, amount: true, treatment: true },
    });
    const entries = computeRange(rows, new Set(dateKeys));

    // --- Range mode ---
    if (range === '7d' || range === '30d') {
      const daysList: DayEntry[] = dateKeys.map((dk) => entries.get(dk)!);

      return NextResponse.json(
        {
          range,
          date: dateParam,
          days: daysList,
          generatedAt: new Date().toISOString(),
          source: 'aido-income-ledger',
        },
        { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
      );
    }

    // --- Single day mode ---
    const entry = entries.get(dateParam)!;

    return NextResponse.json(
      {
        date: dateParam,
        visit: entry.visit,
        homeTreatment: entry.homeTreatment,
        generatedAt: new Date().toISOString(),
        source: 'aido-income-ledger',
      },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[FO PERFORMANCE] GET error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data performance.' },
      { status: 500 },
    );
  }
}
