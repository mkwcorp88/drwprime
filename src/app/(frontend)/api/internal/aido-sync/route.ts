import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getPreviousJakartaDate, isValidSyncDate } from '@/lib/aido/mapping';
import { getAidoCutoverDate } from '@/lib/aido/config';
import { prisma } from '@/lib/prisma';
import {
  AidoSyncAlreadyRunningError,
  AidoSyncIncompleteError,
  runAidoSync,
} from '@/lib/aido/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 900;

function hasValidSecret(req: NextRequest): boolean {
  const expected = process.env.AIDO_SYNC_SECRET;
  const authorization = req.headers.get('authorization');
  if (!expected || !authorization?.startsWith('Bearer ')) return false;

  const received = authorization.slice('Bearer '.length);
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length
    && timingSafeEqual(expectedBuffer, receivedBuffer);
}

function nextDate(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

async function getNextPendingDate(throughDate: string): Promise<string | null> {
  const cutoverDate = getAidoCutoverDate();
  const hospitalId = process.env.AIDO_HOSPITAL_ID?.trim();
  if (!cutoverDate || !hospitalId) return null;

  const completedRuns = await prisma.aidoSyncRun.findMany({
    where: {
      hospitalId,
      status: { in: ['COMPLETED', 'COMPLETED_REVIEW'] },
      mode: { not: 'dry-run' },
      syncDate: { gte: cutoverDate, lte: throughDate },
    },
    distinct: ['syncDate'],
    select: { syncDate: true },
  });
  const completedDates = new Set(completedRuns.map((run) => run.syncDate));
  for (let date = cutoverDate; date <= throughDate; date = nextDate(date)) {
    if (!completedDates.has(date)) return date;
  }
  return null;
}

export async function POST(req: NextRequest) {
  if (!process.env.AIDO_SYNC_SECRET) {
    return NextResponse.json({ error: 'Sync is not configured' }, { status: 503 });
  }
  if (!hasValidSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { date?: unknown; dryRun?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // A scheduled request may intentionally have no JSON body.
  }

  const dryRunParam = req.nextUrl.searchParams.get('dryRun');
  const dryRun = dryRunParam === 'true' || body.dryRun === true;
  if (
    !dryRun
    && process.env.AIDO_SYNC_CANONICAL_SPENDING !== 'true'
    && process.env.AIDO_SYNC_IMPORT_REVENUE !== 'true'
  ) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: 'AIDO revenue import and canonical spending are disabled',
    });
  }
  const dateValue = req.nextUrl.searchParams.get('date') || body.date;
  const previousDate = getPreviousJakartaDate();
  const date = typeof dateValue === 'string' && dateValue
    ? dateValue
    : dryRun
      ? previousDate
      : await getNextPendingDate(previousDate);
  if (!date) {
    if (!getAidoCutoverDate() || !process.env.AIDO_HOSPITAL_ID?.trim()) {
      return NextResponse.json({ error: 'Sync cutover or hospital is not configured' }, { status: 503 });
    }
    return NextResponse.json({ success: true, skipped: true, reason: 'No pending dates' });
  }
  if (!isValidSyncDate(date)) {
    return NextResponse.json({ error: 'Invalid date; expected YYYY-MM-DD' }, { status: 400 });
  }
  if (date > previousDate) {
    return NextResponse.json({ error: 'Sync date must be a completed Jakarta date' }, { status: 400 });
  }

  try {
    const summary = await runAidoSync({
      date,
      dryRun,
      mode: req.headers.get('x-aido-sync-mode') || 'scheduled',
    });
    return NextResponse.json({ success: true, summary });
  } catch (error) {
    if (error instanceof AidoSyncAlreadyRunningError) {
      return NextResponse.json({ error: 'Sync is already running' }, { status: 409 });
    }
    if (error instanceof AidoSyncIncompleteError) {
      return NextResponse.json(
        { error: 'AIDO sync requires review', summary: error.summary },
        { status: 422 },
      );
    }
    return NextResponse.json({ error: 'AIDO sync failed' }, { status: 502 });
  }
}
