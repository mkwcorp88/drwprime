import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMember } from '@/lib/member-auth/session';
import { assertMemberOrigin, memberError, memberResponse } from '@/lib/member-auth/http';
import { createWithdrawal, WithdrawalError } from '@/lib/services/withdrawal';

export async function POST(req: NextRequest) {
  try {
    const member = await requireMember();
    assertMemberOrigin(req);

    const body = await req.json();
    const { amount, accountType, bankName, accountNumber, accountName } = body;

    if (!amount || !accountType || !bankName || !accountNumber || !accountName) {
      return NextResponse.json({ error: 'Semua field harus diisi' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: member.id },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    let bankAccount = await prisma.bankAccount.findFirst({
      where: { userId: user.id, accountType, bankName, accountNumber },
    });

    if (!bankAccount) {
      bankAccount = await prisma.bankAccount.create({
        data: { userId: user.id, accountType, bankName, accountNumber, accountName, isDefault: false },
      });
    }

    const withdrawal = await createWithdrawal(user.id, bankAccount.id, amount);

    return NextResponse.json({ success: true, withdrawal }, { status: 201 });
  } catch (error) {
    if (error instanceof WithdrawalError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return memberError(error);
  }
}

export async function GET() {
  try {
    const member = await requireMember();

    const user = await prisma.user.findUnique({
      where: { id: member.id },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    const withdrawals = await prisma.withdrawal.findMany({
      where: { userId: user.id },
      include: { bankAccount: true },
      orderBy: { createdAt: 'desc' },
    });

    return memberResponse({ success: true, withdrawals });
  } catch (error) {
    return memberError(error);
  }
}
