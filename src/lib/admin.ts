import { auth } from '@clerk/nextjs/server';
import { prisma } from './prisma';

export async function isUserAdmin(): Promise<boolean> {
  const { userId } = await auth();
  
  if (!userId) {
    return false;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { isAdmin: true, email: true }
    });

    if (!user) return false;

    return user.isAdmin || ADMIN_EMAILS.includes(user.email);
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

export const ADMIN_USER_IDS = [
  'user_36gdG2sWQfY5wdGby1gGgML4ziC',
  'user_36jTRE55RsrJHmYbYOaG2yK5MPf'
];

export const ADMIN_EMAILS = [
  'drwcorpora@gmail.com'
];
