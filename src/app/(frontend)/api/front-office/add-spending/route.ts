import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';
import { isAidoManagedSpendingDate } from '@/lib/aido/config';
import {
  sendSpendingNotification,
  sendTierUpgradeNotification,
  computeMemberTier,
} from '@/lib/whatsapp';

const RUPIAH_PER_POINT = 10_000; // Rp 10.000 = 1 poin

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const { userId } = await auth();
    const body = await req.json();
    const { phone, qrToken, amount, treatment, date } = body;

    // Lookup member by phone OR qrToken
    let member;
    if (phone) {
      const cleanPhone = phone.trim();
      member = await prisma.user.findUnique({
        where: { phone: cleanPhone },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          points: true,
          totalSpending: true,
          lastTransactionAt: true,
          hasAccount: true,
          spendingRecords: { select: { id: true }, take: 1 },
        },
      });
    } else if (qrToken) {
      member = await prisma.user.findUnique({
        where: { qrToken: qrToken.trim() },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          points: true,
          totalSpending: true,
          lastTransactionAt: true,
          hasAccount: true,
          spendingRecords: { select: { id: true }, take: 1 },
        },
      });
    }

    if (!member) {
      return NextResponse.json(
        { error: 'Member tidak ditemukan. Pastikan nomor HP atau QR valid.' },
        { status: 404 }
      );
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Nominal spending tidak valid' }, { status: 400 });
    }

    const spendingDate = date
      ? /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? new Date(`${date}T00:00:00+07:00`)
        : new Date(date)
      : new Date();
    if (isNaN(spendingDate.getTime())) {
      return NextResponse.json({ error: 'Tanggal tidak valid' }, { status: 400 });
    }
    if (isAidoManagedSpendingDate(spendingDate)) {
      return NextResponse.json(
        { error: 'Spending dicatat otomatis dari AIDO setelah cutover.' },
        { status: 409 }
      );
    }

    const pointsEarned = Math.floor(amount / RUPIAH_PER_POINT);

    // Cek: apakah ini transaksi pertama? (sebelum spending)
    const isFirstTransaction = member.spendingRecords.length === 0;
    const oldTotalSpending = Number(member.totalSpending);
    const oldTier = computeMemberTier(oldTotalSpending);

    // Transaction: create spending record + update member
    const [spendingRecord, updatedUser] = await prisma.$transaction(async (tx) => {
      const created = await tx.spendingRecord.create({
        data: {
          userId: member.id,
          amount,
          treatment: treatment?.trim() || null,
          spendingDate,
          pointsEarned,
          recordedByClerkId: userId ?? null,
          source: 'front_office',
        },
      });
      const updated = await tx.user.update({
        where: { id: member.id },
        data: {
          points: { increment: pointsEarned },
          totalSpending: { increment: amount },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          points: true,
          totalSpending: true,
          hasAccount: true,
        },
      });
      const newTotalSpending = Number(updated.totalSpending);
      const newTier = computeMemberTier(newTotalSpending);
      await tx.user.updateMany({
        where: {
          id: member.id,
          OR: [{ lastTransactionAt: null }, { lastTransactionAt: { lt: spendingDate } }],
        },
        data: { lastTransactionAt: spendingDate },
      });
      if (newTier !== oldTier) {
        await tx.user.update({ where: { id: member.id }, data: { loyaltyLevel: newTier } });
      }
      return [created, updated] as const;
    });

    const newTotalSpending = Number(updatedUser.totalSpending);
    const newTier = computeMemberTier(newTotalSpending);

    // Count spending records (after insert)
    const transactionCount = await prisma.spendingRecord.count({
      where: { userId: member.id },
    });

    // Kirim WA notification (fire-and-forget, jangan block response)
    const memberName = [member.firstName, member.lastName].filter(Boolean).join(' ') || 'Member';

    if (member.phone) {
      // A. Notifikasi spending
      sendSpendingNotification({
        memberName,
        memberPhone: member.phone,
        isWalkIn: !member.hasAccount,
        isFirstTransaction,
        amount,
        pointsEarned,
        totalPoints: updatedUser.points,
        totalSpending: newTotalSpending,
        tier: newTier,
        treatment,
        transactionCount,
      }).catch((err) => console.warn('[WA] Spending notification failed:', err));

      // B. Notifikasi tier upgrade (jika berubah)
      if (newTier !== oldTier && oldTier !== 'Platinum') {
        sendTierUpgradeNotification({
          memberName,
          memberPhone: member.phone,
          previousTier: oldTier,
          newTier,
          totalPoints: updatedUser.points,
          totalSpending: newTotalSpending,
          benefits: getTierBenefits(newTier),
        }).catch((err) => console.warn('[WA] Tier upgrade notification failed:', err));
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Poin berhasil ditambahkan',
      pointsEarned,
      member: updatedUser,
      spendingRecord: {
        id: spendingRecord.id,
        amount: spendingRecord.amount,
        treatment: spendingRecord.treatment,
        spendingDate: spendingRecord.spendingDate,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[ADD-SPENDING] Error:', error);
    return NextResponse.json(
      { error: 'Gagal mencatat spending' },
      { status: 500 }
    );
  }
}

function getTierBenefits(tier: string): string[] {
  if (tier === 'Platinum') {
    return [
      'Konsultan kecantikan pribadi',
      'Diskon 20% semua treatment',
      'Free treatment setiap 3 bulan',
      'Priority queue',
    ];
  }
  if (tier === 'Gold') {
    return [
      'Skin check gratis tiap bulan',
      'Diskon 15% semua treatment',
      'Akses early promo',
    ];
  }
  return [
    'Priority booking',
    'Diskon 10% di hari ulang tahun',
    'Akses promo eksklusif',
  ];
}
