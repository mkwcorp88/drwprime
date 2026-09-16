import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { cache } from 'react';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { MEMBER_SESSION_COOKIE, MEMBER_SESSION_SECONDS, MemberAuthError } from './policy';

export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');
export const validToken = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);

export const memberCookieOptions = (maxAge: number) => ({
  httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge,
});

export async function createMemberSessionTx(tx: Prisma.TransactionClient, userId: string): Promise<string> {
  const token = newToken();
  await tx.memberSession.deleteMany({ where: { userId, expiresAt: { lte: new Date() } } });
  await tx.memberSession.create({ data: {
    userId, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + MEMBER_SESSION_SECONDS * 1000),
  } });
  return token;
}

export async function resolveMemberToken(token: string | undefined) {
  if (!validToken(token)) return null;
  const session = await prisma.memberSession.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: true } });
  if (!session || session.expiresAt <= new Date() || !session.user.hasAccount || !session.user.loginPhoneVerifiedAt || !session.user.loginPhone || session.user.memberLoginBlockedAt) return null;
  return session.user;
}

export const getMember = cache(async () => resolveMemberToken((await cookies()).get(MEMBER_SESSION_COOKIE)?.value));

export async function requireMember() {
  const member = await getMember();
  if (!member) throw new MemberAuthError(401, 'Silakan masuk dengan nomor WhatsApp Anda.', 'MEMBER_AUTH_REQUIRED');
  return member;
}

export async function logoutMember(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(MEMBER_SESSION_COOKIE)?.value;
  if (validToken(token)) await prisma.memberSession.deleteMany({ where: { tokenHash: tokenHash(token) } });
  jar.set(MEMBER_SESSION_COOKIE, '', memberCookieOptions(0));
}
