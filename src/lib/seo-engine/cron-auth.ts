/**
 * Shared Bearer guard for the SEO cron routes.
 *
 * These routes are listed in `isPublicRoute` (src/middleware.ts) so Clerk lets
 * them through — CRON_SECRET is therefore the ONLY thing standing in front of
 * them, and an unset secret must fail closed rather than leave them open.
 */
import { NextResponse } from 'next/server';

export function guardCron(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error('[seo-engine] CRON_SECRET belum diset — endpoint menolak jalan');
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
