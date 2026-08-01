import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export async function GET() {
  try {
    const pushResult = execSync('npx prisma db push --accept-data-loss', {
      encoding: 'utf-8',
      timeout: 60000,
      env: { ...process.env },
    });
    const seedResult = execSync('tsx prisma/seed.ts', {
      encoding: 'utf-8',
      timeout: 60000,
      env: { ...process.env },
    });

    return NextResponse.json({
      success: true,
      pushOutput: pushResult.trim(),
      seedOutput: seedResult.trim(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Setup failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
