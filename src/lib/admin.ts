/**
 * Admin authorization.
 *
 * Historical Clerk identifiers are retained only for the one-time staff
 * migration and CMS access. Live authorization uses StaffAccount sessions.
 */

export const ADMIN_USER_IDS = [
  'user_36gdG2sWQfY5wdGby1gGgML4ziC',
  'user_36jTRE55RsrJHmYbYOaG2yK5MPf',
] as const;

export const ADMIN_EMAILS = [
  'wahyu.putri@drwcorp.com',
] as const;

export function isHardcodedAdmin(userId: string): boolean {
  return ADMIN_USER_IDS.includes(userId as (typeof ADMIN_USER_IDS)[number]);
}

export function isAdminByEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase() as (typeof ADMIN_EMAILS)[number]);
}

/**
 * @deprecated Use `requireAdmin()` from `@/lib/auth` instead.
 * Returns true/false without throwing.
 */
export async function isUserAdmin(): Promise<boolean> {
  try {
    const { requireAdmin } = await import('@/lib/auth');
    await requireAdmin();
    return true;
  } catch { return false; }
}
