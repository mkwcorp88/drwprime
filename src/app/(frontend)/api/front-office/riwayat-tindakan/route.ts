import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isUserAdmin } from '@/lib/admin';

export async function GET(req: NextRequest) {
  try {
    if (!(await isUserAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const records = await prisma.riwayatTindakan.findMany({
      where: { userId },
      orderBy: { tanggalKunjungan: 'desc' },
      take: 50,
    });

    return NextResponse.json({ success: true, records });
  } catch (error) {
    console.error('[RIWAYAT-TINDAKAN] Error:', error);
    return NextResponse.json({ error: 'Gagal memuat riwayat tindakan' }, { status: 500 });
  }
}
