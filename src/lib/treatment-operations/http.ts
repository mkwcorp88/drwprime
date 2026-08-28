import { NextResponse } from 'next/server';
import { OpsError } from './utils';

export function handleOpsError(error: unknown, context: string): NextResponse {
  if (error instanceof OpsError) {
    return NextResponse.json({ error: error.message, ...(error.code ? { code: error.code } : {}) }, { status: error.status });
  }
  console.error(`[TREATMENT OPS] ${context}:`, error);
  return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    throw new OpsError(400, 'Format JSON tidak valid.');
  }
}
