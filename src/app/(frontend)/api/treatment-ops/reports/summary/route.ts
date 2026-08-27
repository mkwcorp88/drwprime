import { NextResponse } from 'next/server';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { REPORT_ROLES } from '@/lib/treatment-operations/constants';
import { handleOpsError } from '@/lib/treatment-operations/http';
import { buildSummaryReport } from '@/lib/treatment-operations/report-service';
import { getPeriodRange, OpsError, type PeriodKey } from '@/lib/treatment-operations/utils';

const PERIODS: readonly PeriodKey[] = ['today', 'week', 'month', 'year', 'custom'];

export async function GET(request: Request) {
  try {
    const actor = await requireOpsStaff(REPORT_ROLES);
    const url = new URL(request.url);
    const period = (url.searchParams.get('period') ?? 'week') as PeriodKey;
    if (!PERIODS.includes(period)) throw new OpsError(400, 'Periode tidak valid.');
    const range = getPeriodRange(
      period,
      url.searchParams.get('start') ?? undefined,
      url.searchParams.get('end') ?? undefined,
    );
    return NextResponse.json(await buildSummaryReport(actor, range));
  } catch (error) {
    return handleOpsError(error, 'summary report');
  }
}
