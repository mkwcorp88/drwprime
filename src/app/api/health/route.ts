import { NextResponse } from 'next/server';
import { getPayloadClient } from '@/lib/payload';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const headers = { 'Cache-Control': 'no-store' };
const requiredEnvironment = [
  'DATABASE_URL',
  'DATABASE_URI',
  'PAYLOAD_SECRET',
  'CLERK_SECRET_KEY',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'S3_ENDPOINT',
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
] as const;

export async function GET() {
  const release = process.env.RELEASE_SHA || 'unknown';

  try {
    if (requiredEnvironment.some((name) => !process.env[name])) {
      throw new Error('Required environment is missing');
    }

    const payload = await getPayloadClient();
    await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      payload.count({ collection: 'posts' }),
    ]);
    return NextResponse.json({ ok: true, release }, { headers });
  } catch (error) {
    console.error(
      '[HEALTH] Readiness check failed:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return NextResponse.json(
      { ok: false, release },
      { status: 503, headers },
    );
  }
}
