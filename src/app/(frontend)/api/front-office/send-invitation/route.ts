import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isUserAdmin } from '@/lib/admin';
import { sendManualInvitation } from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
  try {
    if (!(await isUserAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { memberId } = body;

    if (!memberId) {
      return NextResponse.json({ error: 'ID member wajib diisi' }, { status: 400 });
    }

    // Cek member exists dan masih walk-in
    const member = await prisma.user.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        points: true,
        totalSpending: true,
        hasAccount: true,
        _count: { select: { spendingRecords: true } },
      },
    });

    if (!member) {
      return NextResponse.json({ error: 'Member tidak ditemukan' }, { status: 404 });
    }

    if (member.hasAccount) {
      return NextResponse.json(
        { error: 'Member ini sudah memiliki akun, tidak perlu kirim undangan.' },
        { status: 400 }
      );
    }

    if (!member.phone) {
      return NextResponse.json(
        { error: 'Member belum memiliki nomor WhatsApp.' },
        { status: 400 }
      );
    }

    const memberName = [member.firstName, member.lastName].filter(Boolean).join(' ') || 'Member';
    const tier = Number(member.totalSpending) >= 5_000_000
      ? 'PLATINUM'
      : Number(member.totalSpending) >= 1_000_000
      ? 'GOLD'
      : 'SILVER';

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://drwprime.com';
    const inviteLink = `${appUrl}/sign-up?phone=${encodeURIComponent(member.phone)}`;

    // Kirim WA (fire-and-forget)
    sendManualInvitation({
      memberName,
      memberPhone: member.phone,
      points: member.points,
      totalSpending: Number(member.totalSpending),
      tier,
      transactionCount: member._count.spendingRecords,
      inviteLink,
    }).catch((err) => console.warn('[WA] Manual invitation failed:', err));

    return NextResponse.json({
      success: true,
      message: `Undangan berhasil dikirim ke ${memberName}`,
    });
  } catch (error) {
    console.error('[SEND-INVITATION] Error:', error);
    return NextResponse.json(
      { error: 'Gagal mengirim undangan' },
      { status: 500 }
    );
  }
}
