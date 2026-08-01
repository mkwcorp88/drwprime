import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';

export async function GET() {
  try {
    const cwd = process.cwd();
    const prismaBin = path.join(cwd, 'node_modules', '.bin', 'prisma');

    const pushResult = execSync(`${prismaBin} db push --accept-data-loss`, {
      encoding: 'utf-8',
      timeout: 60000,
      cwd,
    });

    const seedResult = execSync(`${path.join(cwd, 'node_modules', '.bin', 'tsx')} prisma/seed.ts`, {
      encoding: 'utf-8',
      timeout: 60000,
      cwd,
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
