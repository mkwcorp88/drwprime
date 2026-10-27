import { NextResponse } from 'next/server';
import { requireStaff, StaffAuthError } from '@/lib/staff-auth/service';

export type AuthUser = {
  staffId: string;
  // Historical actor IDs in marketing/FO tables remain stable after cutover.
  clerkUserId: string;
  isAdmin: boolean;
  cmsAccess: boolean;
  primaryEmail: string | null;
  firstName: string | null;
  lastName: string | null;
  primaryPhone: string | null;
  verifiedPhones: string[];
};

export async function requireUser(): Promise<AuthUser> {
  try {
    const staff = await requireStaff();
    const [firstName, ...lastName] = staff.name.trim().split(/\s+/);
    return {
      staffId: staff.id,
      clerkUserId: staff.legacyClerkId || `staff:${staff.id}`,
      isAdmin: true,
      cmsAccess: staff.cmsAccess,
      primaryEmail: staff.email,
      firstName: firstName || null,
      lastName: lastName.join(' ') || null,
      primaryPhone: staff.phone,
      verifiedPhones: staff.phone ? [staff.phone] : [],
    };
  } catch (error) {
    if (error instanceof StaffAuthError) throw new AuthError(401, error.message);
    throw error;
  }
}

export async function requireAdmin(): Promise<AuthUser> {
  return requireUser();
}

export class AuthError extends Error {
  constructor(public readonly status: 401 | 403, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export function handleAuthError(err: unknown): NextResponse {
  if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error('[AUTH] Unexpected error:', err);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
