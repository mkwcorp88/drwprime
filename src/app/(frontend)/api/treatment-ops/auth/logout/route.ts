import { NextResponse } from 'next/server';
import { logoutOpsStaff } from '@/lib/treatment-operations/auth';

export async function POST(request: Request) {
  await logoutOpsStaff();
  return NextResponse.redirect(new URL('/treatment-ops/login', request.url), { status: 303 });
}
