import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isUserAdmin } from '@/lib/admin';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    if (!(await isUserAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { phone, firstName, lastName } = body;

    // Validasi phone format (62xxx)
    if (!phone || typeof phone !== 'string') {
      return NextResponse.json({ error: 'Nomor HP wajib diisi' }, { status: 400 });
    }

    const cleanPhone = phone.trim();
    if (!cleanPhone.match(/^62\d{9,13}$/)) {
      return NextResponse.json(
        { error: 'Format nomor HP tidak valid (harus 62xxxxxxxxx tanpa spasi)' },
        { status: 400 }
      );
    }

    if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
      return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 });
    }

    // Cari existing member by phone
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
        lastTransactionAt: true,
        hasAccount: true,
        memberSince: true,
        qrToken: true,
      },
    });

    if (member) {
      // Update existing member (misal namanya typo, bisa dikoreksi)
      member = await prisma.user.update({
        where: { phone: cleanPhone },
        data: {
          firstName: firstName.trim(),
          lastName: lastName?.trim() || null,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          points: true,
          totalSpending: true,
          lastTransactionAt: true,
          hasAccount: true,
          memberSince: true,
          qrToken: true,
        },
      });

      return NextResponse.json({
        success: true,
        member,
        message: 'Member berhasil diupdate',
      });
    } else {
      // Create new walk-in member
      member = await prisma.user.create({
        data: {
          phone: cleanPhone,
          firstName: firstName.trim(),
          lastName: lastName?.trim() || null,
          hasAccount: false,
          qrToken: randomUUID(), // auto-generate QR token
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          points: true,
          totalSpending: true,
          lastTransactionAt: true,
          hasAccount: true,
          memberSince: true,
          qrToken: true,
        },
      });

      return NextResponse.json({
        success: true,
        member,
        message: 'Member baru berhasil didaftarkan',
      });
    }
  } catch (error) {
    console.error('[MEMBER-UPSERT] Error:', error);
    return NextResponse.json(
      { error: 'Gagal memproses member' },
      { status: 500 }
    );
  }
}
