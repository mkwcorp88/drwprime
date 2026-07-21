import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { isUserAdmin } from '@/lib/admin';
import { normalizePhone } from '@/lib/phone';
import { randomUUID } from 'crypto';
import {
  sendSpendingNotification,
  sendTierUpgradeNotification,
  computeMemberTier,
} from '@/lib/whatsapp';

const RUPIAH_PER_POINT = 10_000; // Rp 10.000 = 1 poin

/**
 * API untuk FO menambahkan poin kepada member (existing atau baru) via nomor WhatsApp
 * 
 * Flow:
 * 1. Terima input: phone, firstName (optional jika member baru), amount, treatment, date
 * 2. Cek apakah member dengan phone tersebut sudah ada
 * 3. Jika belum ada → buat member baru (walk-in member, hasAccount=false)
 * 4. Jika sudah ada → pakai member yang ada
 * 5. Tambahkan spending record & update poin
 * 6. Nanti saat customer sign up, semua data akan ter-merge otomatis (via user/route.ts)
 */
export async function POST(req: NextRequest) {
  try {
    // Check admin authorization
    if (!(await isUserAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await auth();
    const body = await req.json();
    const { phone, firstName, lastName, amount, treatment, date } = body;

    // Validate phone number
    if (!phone || typeof phone !== 'string') {
      return NextResponse.json(
        { error: 'Nomor WhatsApp wajib diisi' },
        { status: 400 }
      );
    }

    // Clean & normalize phone number via canonical utility
    const cleanPhone = normalizePhone(phone.trim());
    
    // Validate phone format (62xxx with 9-13 digits after 62)
    if (!cleanPhone.startsWith('62')) {
      return NextResponse.json(
        { error: `Format nomor WhatsApp tidak valid. Harus 62xxxxxxxxx (input: ${phone})` },
        { status: 400 }
      );
    }

    // Validate amount
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Nominal spending harus lebih dari 0' },
        { status: 400 }
      );
    }

    // Validate date
    const spendingDate = date ? new Date(date) : new Date();
    if (isNaN(spendingDate.getTime())) {
      return NextResponse.json(
        { error: 'Format tanggal tidak valid' },
        { status: 400 }
      );
    }

    // Calculate points earned (1 point per 10k rupiah)
    const pointsEarned = Math.floor(amount / RUPIAH_PER_POINT);

    // Check if member exists by phone
    let member = await prisma.user.findUnique({
      where: { phone: cleanPhone },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        points: true,
        totalSpending: true,
        hasAccount: true,
        qrToken: true,
        spendingRecords: { select: { id: true }, take: 1 },
      },
    });

    let isNewMember = false;

    // If member doesn't exist, create new walk-in member
    if (!member) {
      // Validate firstName for new member
      if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
        return NextResponse.json(
          { error: 'Nama wajib diisi untuk member baru' },
          { status: 400 }
        );
      }

      member = await prisma.user.create({
        data: {
          phone: cleanPhone,
          firstName: firstName.trim(),
          lastName: lastName?.trim() || null,
          hasAccount: false, // Walk-in member, belum punya akun
          qrToken: randomUUID(), // Generate QR token for future scanning
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          points: true,
          totalSpending: true,
          hasAccount: true,
          qrToken: true,
          spendingRecords: { select: { id: true }, take: 1 },
        },
      });

      isNewMember = true;
      console.log(`[ADD-POINTS-BY-PHONE] Created new walk-in member: ${member.id} (${cleanPhone})`);
    } else {
      // Member exists, update name if provided (for correction purposes)
      if (firstName && firstName.trim()) {
        member = await prisma.user.update({
          where: { id: member.id },
          data: {
            firstName: firstName.trim(),
            lastName: lastName?.trim() || member.lastName,
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            points: true,
            totalSpending: true,
            hasAccount: true,
            qrToken: true,
            spendingRecords: { select: { id: true }, take: 1 },
          },
        });
      }
      console.log(`[ADD-POINTS-BY-PHONE] Found existing member: ${member.id} (${cleanPhone})`);
    }

    // Check if this is first transaction (for WhatsApp notification)
    const isFirstTransaction = member.spendingRecords.length === 0;
    const oldTotalSpending = Number(member.totalSpending);
    const oldTier = computeMemberTier(oldTotalSpending);

    // Create spending record & update member points in a transaction
    const [spendingRecord, updatedUser] = await prisma.$transaction([
      prisma.spendingRecord.create({
        data: {
          userId: member.id,
          amount,
          treatment: treatment?.trim() || null,
          spendingDate,
          pointsEarned,
          recordedByClerkId: userId ?? null,
          source: 'front_office',
        },
      }),
      prisma.user.update({
        where: { id: member.id },
        data: {
          points: { increment: pointsEarned },
          totalSpending: { increment: amount },
          lastTransactionAt: spendingDate,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          points: true,
          totalSpending: true,
          hasAccount: true,
          qrToken: true,
        },
      }),
    ]);

    const newTotalSpending = Number(updatedUser.totalSpending);
    const newTier = computeMemberTier(newTotalSpending);

    // Count total transactions for this member
    const transactionCount = await prisma.spendingRecord.count({
      where: { userId: member.id },
    });

    // Send WhatsApp notifications (fire-and-forget)
    const memberName = [updatedUser.firstName, updatedUser.lastName].filter(Boolean).join(' ') || 'Member';

    if (updatedUser.phone) {
      // A. Spending notification
      sendSpendingNotification({
        memberName,
        memberPhone: updatedUser.phone,
        isWalkIn: !updatedUser.hasAccount,
        isFirstTransaction,
        amount,
        pointsEarned,
        totalPoints: updatedUser.points,
        totalSpending: newTotalSpending,
        tier: newTier,
        treatment,
        transactionCount,
      }).catch((err) => console.warn('[WA] Spending notification failed:', err));

      // B. Tier upgrade notification (if tier changed)
      if (newTier !== oldTier && oldTier !== 'PLATINUM') {
        sendTierUpgradeNotification({
          memberName,
          memberPhone: updatedUser.phone,
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
      message: isNewMember 
        ? `Member baru berhasil didaftarkan dan ${pointsEarned} poin telah ditambahkan`
        : `${pointsEarned} poin berhasil ditambahkan`,
      isNewMember,
      pointsEarned,
      member: {
        id: updatedUser.id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        phone: updatedUser.phone,
        email: updatedUser.email,
        points: updatedUser.points,
        totalSpending: Number(updatedUser.totalSpending),
        hasAccount: updatedUser.hasAccount,
        qrToken: updatedUser.qrToken,
        tier: newTier,
      },
      spendingRecord: {
        id: spendingRecord.id,
        amount: Number(spendingRecord.amount),
        treatment: spendingRecord.treatment,
        spendingDate: spendingRecord.spendingDate,
        pointsEarned: spendingRecord.pointsEarned,
      },
      tierUpgrade: newTier !== oldTier ? {
        oldTier,
        newTier,
      } : null,
    });
  } catch (error) {
    console.error('[ADD-POINTS-BY-PHONE] Error:', error);
    
    // Handle unique constraint errors
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Nomor WhatsApp sudah terdaftar di sistem' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Gagal menambahkan poin',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function getTierBenefits(tier: string): string[] {
  if (tier === 'PLATINUM') {
    return [
      'Konsultan kecantikan pribadi',
      'Diskon 20% semua treatment',
      'Free treatment setiap 3 bulan',
      'Priority queue',
    ];
  }
  if (tier === 'GOLD') {
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
