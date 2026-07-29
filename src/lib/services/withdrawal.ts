import { prisma } from '@/lib/prisma';

export class WithdrawalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WithdrawalError';
  }
}

export async function createWithdrawal(
  userId: string,
  bankAccountId: string,
  amount: number,
) {
  if (amount <= 0) throw new WithdrawalError('Jumlah penarikan harus lebih dari 0');

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { totalEarnings: true },
    });

    if (!user) throw new WithdrawalError('User tidak ditemukan');

    const earnings = Number(user.totalEarnings);

    // Calculate available balance (earnings minus pending withdrawals)
    const pendingTotal = await tx.withdrawal.aggregate({
      where: { userId, status: 'pending' },
      _sum: { amount: true },
    });

    const pending = Number(pendingTotal._sum.amount ?? 0);
    const available = earnings - pending;

    if (amount > available) {
      throw new WithdrawalError(
        `Saldo tidak mencukupi. Tersedia: Rp ${available.toLocaleString('id-ID')}`,
      );
    }

    const withdrawal = await tx.withdrawal.create({
      data: {
        userId,
        bankAccountId,
        amount,
        status: 'pending',
        requestDate: new Date(),
      },
    });

    console.log(`[WITHDRAWAL] Created: ${withdrawal.id} — Rp ${amount}`);
    return withdrawal;
  });
}

export async function approveWithdrawal(withdrawalId: string, processedBy: string) {
  return prisma.$transaction(async (tx) => {
    const withdrawal = await tx.withdrawal.findUnique({
      where: { id: withdrawalId },
      select: { status: true, userId: true, amount: true },
    });

    if (!withdrawal) throw new WithdrawalError('Penarikan tidak ditemukan');
    if (withdrawal.status !== 'pending') {
      throw new WithdrawalError(`Penarikan sudah ${withdrawal.status}`);
    }

    // Debit earnings atomically
    await tx.user.update({
      where: { id: withdrawal.userId },
      data: { totalEarnings: { decrement: withdrawal.amount } },
    });

    return tx.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: 'approved',
        processedDate: new Date(),
        processedBy,
      },
    });
  });
}

export async function rejectWithdrawal(
  withdrawalId: string,
  processedBy: string,
  reason?: string,
) {
  return prisma.$transaction(async (tx) => {
    const withdrawal = await tx.withdrawal.findUnique({
      where: { id: withdrawalId },
      select: { status: true },
    });

    if (!withdrawal) throw new WithdrawalError('Penarikan tidak ditemukan');
    if (withdrawal.status !== 'pending') {
      throw new WithdrawalError(`Penarikan sudah ${withdrawal.status}`);
    }

    return tx.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: 'rejected',
        processedDate: new Date(),
        processedBy,
        adminNotes: reason ?? null,
      },
    });
  });
}
