/**
 * Admin authorization.
 *
 * The only authoritative source is the hardcoded Clerk User ID list.
 * Database `isAdmin` flag is a legacy convenience for quick bootstrapping
 * and will be deprecated once all production admins are in this list.
 *
 * IMPORTANT: never use email to determine admin status — email comes
 * from Clerk, not from a request body.
 */
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

export const ADMIN_USER_IDS = [
  'user_36gdG2sWQfY5wdGby1gGgML4ziC',
  'user_36jTRE55RsrJHmYbYOaG2yK5MPf',
] as const;

export function isHardcodedAdmin(userId: string): boolean {
  return ADMIN_USER_IDS.includes(userId as (typeof ADMIN_USER_IDS)[number]);
}

/**
 * @deprecated Use `requireAdmin()` from `@/lib/auth` instead.
 * Returns true/false without throwing.
 */
export async function isUserAdmin(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;

  if (isHardcodedAdmin(userId)) return true;

  try {
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { isAdmin: true },
    });
    return user?.isAdmin ?? false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}
