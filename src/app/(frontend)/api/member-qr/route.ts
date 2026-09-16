import { requireMember } from '@/lib/member-auth/session';
import { memberError, memberResponse } from '@/lib/member-auth/http';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const member = await requireMember();

    const user = await prisma.user.findUnique({
      where: { id: member.id },
      select: { id: true, qrToken: true, firstName: true, lastName: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found', needsSync: true }, { status: 404 });
    }

    let qrToken = user.qrToken;
    if (!qrToken) {
      qrToken = randomUUID();
      await prisma.user.update({
        where: { id: user.id },
        data: { qrToken },
      });
    }

    return memberResponse({
      qrToken,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Member',
    });
  } catch (error) {
    return memberError(error);
  }
}
