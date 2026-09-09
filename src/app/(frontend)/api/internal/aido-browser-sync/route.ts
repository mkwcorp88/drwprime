import { NextRequest, NextResponse } from 'next/server';
import { getPreviousJakartaDate, isValidSyncDate } from '@/lib/aido/mapping';
import { hasValidAidoSyncSecret } from '@/lib/aido/sync-auth';
import {
  AidoSyncAlreadyRunningError,
  AidoSyncIncompleteError,
  runAidoSync,
} from '@/lib/aido/sync';
import type { AidoSession } from '@/lib/aido/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 900;

type BrowserSyncBody = {
  date?: unknown;
  dryRun?: unknown;
  hospitalId?: unknown;
  hospitalGroupId?: unknown;
  patients?: unknown;
  income?: unknown;
};

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asRows(value: unknown): unknown[] | null {
  return Array.isArray(value) && value.length <= 100_000 ? value : null;
}

export async function POST(request: NextRequest) {
  if (!process.env.AIDO_SYNC_SECRET) {
    return NextResponse.json({ error: 'Sync is not configured' }, { status: 503 });
  }
  if (!hasValidAidoSyncSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: BrowserSyncBody;
  try {
    body = await request.json() as BrowserSyncBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const date = asString(body.date) || getPreviousJakartaDate();
  const hospitalId = asString(body.hospitalId);
  const hospitalGroupId = asString(body.hospitalGroupId);
  const patients = asRows(body.patients);
  const income = asRows(body.income);
  const dryRun = body.dryRun === true;
  const configuredHospitalId = process.env.AIDO_HOSPITAL_ID?.trim();
  const configuredHospitalGroupId = process.env.AIDO_HOSPITAL_GROUP_ID?.trim();

  if (!isValidSyncDate(date)) {
    return NextResponse.json({ error: 'Invalid date; expected YYYY-MM-DD' }, { status: 400 });
  }
  if (!hospitalId || !hospitalGroupId || !configuredHospitalId || !configuredHospitalGroupId) {
    return NextResponse.json({ error: 'AIDO hospital configuration is incomplete' }, { status: 503 });
  }
  if (hospitalId !== configuredHospitalId || hospitalGroupId !== configuredHospitalGroupId) {
    return NextResponse.json({ error: 'AIDO hospital does not match this application' }, { status: 403 });
  }
  if (!patients || !income || (patients.length === 0 && income.length === 0)) {
    return NextResponse.json({ error: 'patients and income arrays are required' }, { status: 400 });
  }
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

  const session: AidoSession = {
    accessToken: 'browser-payload',
    hospitalId,
    hospitalGroupId,
    hospitalName: null,
  };
  const source = {
    login: async () => session,
    getAllPatients: async () => patients,
    getIncome: async () => income,
  };

  try {
    const summary = await runAidoSync({
      date,
      dryRun,
      mode: 'browser-vps',
      source,
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
    console.error('[AIDO BROWSER SYNC] Failed', error instanceof Error ? error.name : 'UNKNOWN_ERROR');
    return NextResponse.json({ error: 'AIDO browser sync failed' }, { status: 502 });
  }
}
