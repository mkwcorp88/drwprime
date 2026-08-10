import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, handleAuthError } from '@/lib/auth';

const SHEET_ID = '1Bqr34hyD4xL6L5lp03UVYJYlF_c5YxNKJOMkXcyt8XE';
const GVQ_BASE = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq`;
const GID_VISIT = 907106318;
const GID_HT = 527981502;
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

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
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(new Date(value).getTime());
}

function addDays(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + delta);
  return getJakartaDateKey(date);
}

// Convert GViz Date(year, month, day) → YYYY-MM-DD
function gvizDateToKey(raw: string | null): string | null {
  if (!raw) return null;
  const match = raw.match(/Date\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

// Google Viz cell → number
function cellNum(cell: unknown): number {
  if (cell === null || cell === undefined) return 0;
  if (typeof cell === 'object' && cell !== null && 'v' in cell) {
    const raw = (cell as Record<string, unknown>).v;
    return typeof raw === 'number' ? raw : 0;
  }
  return typeof cell === 'number' ? cell : 0;
}

// Google Viz cell → trimmed string, never null
function cellStr(cell: unknown): string {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'object' && cell !== null && 'v' in cell) {
    const raw = (cell as Record<string, unknown>).v;
    return typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
  }
  return typeof cell === 'string' ? cell.trim() : String(cell ?? '').trim();
}

// --------------- fetch & parse ---------------

interface GvizCol {
  id: string;
  label: string;
  type: string;
}

interface GvizTable {
  cols: GvizCol[];
  rows: Array<{ c: unknown[] }>;
}

function parseGvizResponse(text: string): GvizTable {
  // Strip JS wrapper
  const prefix = '/*O_o*/\ngoogle.visualization.Query.setResponse(';
  const clean = text.startsWith(prefix)
    ? text.slice(prefix.length, text.lastIndexOf(');'))
    : text;

  const parsed = JSON.parse(clean) as {
    status: string;
    table: GvizTable;
  };

  if (parsed.status !== 'ok') {
    throw new Error('Google Sheets response status not ok');
  }

  return parsed.table;
}

async function fetchSheet(gid: number, range: string, query: string): Promise<GvizTable> {
  const url = `${GVQ_BASE}?tqx=out:json&gid=${gid}&range=${encodeURIComponent(range)}&headers=1&tq=${encodeURIComponent(query)}`;
  const res = await fetch(url, { next: { revalidate: 0 } });

  if (!res.ok) {
    throw new Error(`Google Sheets fetch failed gid=${gid} status=${res.status}`);
  }

  const text = await res.text();
  return parseGvizResponse(text);
}

// --------------- domain ---------------

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

function isOngkir(treatment: string): boolean {
  const lower = treatment.toLowerCase().replace(/\s+/g, '');
  return lower.includes('ongkir') || lower === 'ongkir';
}

function customerKey(rm: string, phone: string, name: string): string {
  const rmClean = rm.replace(/\s+/g, '').toLowerCase();
  if (rmClean) return `rm:${rmClean}`;

  const phoneClean = phone.replace(/[\s\-()+]/g, '');
  if (phoneClean) return `hp:${phoneClean}`;

  return `name:${name.replace(/\s+/g, ' ').trim().toLowerCase()}`;
}

function buildRangeKeys(endDateKey: string, days: number): string[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    keys.push(addDays(endDateKey, -i));
  }
  return keys;
}

function computeRange(
  visitTable: GvizTable,
  htTable: GvizTable,
  targetDateKeys: Set<string>,
): Map<string, DayEntry> {
  const entries = new Map<string, DayEntry>();
  for (const dk of targetDateKeys) {
    entries.set(dk, { date: dk, visit: emptyResult(), homeTreatment: emptyResult() });
  }

  // --- Visit Klinik ---
  const visitCols = visitTable.cols;
  const visitIdx = {
    tanggal: visitCols.findIndex((c) => c.id === 'B'),
    pendapatan: visitCols.findIndex((c) => c.id === 'C'),
    customerBaru: visitCols.findIndex((c) => c.id === 'J'),
    customerLama: visitCols.findIndex((c) => c.id === 'K'),
  };

  for (const row of visitTable.rows) {
    if (!row.c || row.c.length < 4) continue;
    const dateKey = gvizDateToKey(cellStr(row.c[visitIdx.tanggal]));
    if (!dateKey || !entries.has(dateKey)) continue;
    const entry = entries.get(dateKey)!;
    entry.visit.visits += Math.round(cellNum(row.c[visitIdx.customerBaru]) + cellNum(row.c[visitIdx.customerLama]));
    entry.visit.omzet += Math.round(cellNum(row.c[visitIdx.pendapatan]));
  }

  // --- Home Treatment ---
  const htCols = htTable.cols;
  const htIdx = {
    tanggal: htCols.findIndex((c) => c.id === 'A'),
    customer: htCols.findIndex((c) => c.id === 'C'),
    phone: htCols.findIndex((c) => c.id === 'D'),
    rm: htCols.findIndex((c) => c.id === 'E'),
    treatment: htCols.findIndex((c) => c.id === 'H'),
    payment: htCols.findIndex((c) => c.id === 'L'),
  };

  const htCustomers = new Map<string, Set<string>>();
  for (const dk of targetDateKeys) htCustomers.set(dk, new Set());

  for (const row of htTable.rows) {
    if (!row.c || row.c.length < 6) continue;
    const dateKey = gvizDateToKey(cellStr(row.c[htIdx.tanggal]));
    if (!dateKey || !entries.has(dateKey)) continue;

    const entry = entries.get(dateKey)!;
    const treatmentText = cellStr(row.c[htIdx.treatment]) || '';
    const payment = Math.round(cellNum(row.c[htIdx.payment]));
    if (!isOngkir(treatmentText)) {
      entry.homeTreatment.omzet += payment;
    }

    const key = customerKey(
      cellStr(row.c[htIdx.rm]),
      cellStr(row.c[htIdx.phone]),
      cellStr(row.c[htIdx.customer]),
    );
    htCustomers.get(dateKey)!.add(key);
  }

  for (const [dk, customers] of htCustomers) {
    const entry = entries.get(dk);
    if (entry) entry.homeTreatment.visits = customers.size;
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

    const now = new Date();
    const jakartaNow = new Date(now.getTime() + JAKARTA_OFFSET_MS);
    const todayKey = jakartaNow.toISOString().slice(0, 10);

    if (dateParam > todayKey) {
      return NextResponse.json({ error: 'Tidak dapat melihat tanggal yang belum terjadi.' }, { status: 400 });
    }

    const [visitTable, htTable] = await Promise.all([
      fetchSheet(GID_VISIT, 'A4:K369', 'select B, C, J, K'),
      fetchSheet(GID_HT, 'A3:M', 'select A, C, D, E, H, L'),
    ]);

    // --- Range mode ---
    if (range === '7d' || range === '30d') {
      const days = range === '7d' ? 7 : 30;
      const rangeKeys = buildRangeKeys(dateParam, days);
      const entries = computeRange(visitTable, htTable, new Set(rangeKeys));
      const daysList: DayEntry[] = rangeKeys.map((dk) => entries.get(dk)!);

      return NextResponse.json(
        {
          range,
          date: dateParam,
          days: daysList,
          generatedAt: new Date().toISOString(),
        },
        { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
      );
    }

    // --- Single day mode ---
    const singleSet = new Set([dateParam]);
    const entryMap = computeRange(visitTable, htTable, singleSet);
    const entry = entryMap.get(dateParam)!;

    return NextResponse.json(
      {
        date: dateParam,
        visit: entry.visit,
        homeTreatment: entry.homeTreatment,
        generatedAt: new Date().toISOString(),
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
