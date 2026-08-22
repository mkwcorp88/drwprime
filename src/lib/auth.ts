import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { isHardcodedAdmin, isAdminByEmail } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';

export type AuthUser = {
  clerkUserId: string;
  isAdmin: boolean;
  primaryEmail: string | null;
  firstName: string | null;
  lastName: string | null;
  primaryPhone: string | null;
  verifiedPhones: string[];
};

/**
 * Require a signed-in Clerk session. Returns verified identity fields
 * obtained exclusively from Clerk server-side — NEVER trust a request body
 * for identity or role.
 */
async function isDbAdmin(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { isAdmin: true },
    });
    return user?.isAdmin ?? false;
  } catch (error) {
    console.error('Error checking db admin status:', error);
    return false;
  }
}

export async function requireUser(): Promise<AuthUser> {
  const { userId } = await auth();
  if (!userId) {
    throw new AuthError(401, 'Unauthorized — please sign in.');
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    throw new AuthError(401, 'Unauthorized — session invalid.');
  }

  const primaryEmail = clerkUser.emailAddresses[0]?.emailAddress ?? null;
  const isAdmin = isHardcodedAdmin(userId) || isAdminByEmail(primaryEmail) || (await isDbAdmin(userId));
  const verifiedPhones = clerkUser.phoneNumbers
    .filter((phone) => phone.verification?.status === 'verified')
    .map((phone) => normalizePhone(phone.phoneNumber))
    .filter((phone) => /^62\d{8,13}$/.test(phone));

  return {
    clerkUserId: userId,
    isAdmin,
    primaryEmail,
    firstName: clerkUser.firstName ?? null,
    lastName: clerkUser.lastName ?? null,
    primaryPhone: clerkUser.phoneNumbers[0]?.phoneNumber ?? null,
    verifiedPhones,
  };
}

/**
 * Require admin privileges. Uses the hardcoded admin list as the
 * authoritative source.
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (!user.isAdmin) {
    throw new AuthError(403, 'Forbidden — admin access required.');
  }
  return user;
}

export class AuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Convenience: wrap a route handler — catches AuthError and returns JSON.
 */
export function handleAuthError(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error('[AUTH] Unexpected error:', err);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
