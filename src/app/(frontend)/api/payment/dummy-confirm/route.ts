import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { publicToken, paymentMethod } = body;

    if (!publicToken) {
      return NextResponse.json({ error: 'Token pesanan wajib disertakan' }, { status: 400 });
    }

    const order = await prisma.productOrder.findUnique({
      where: { publicToken },
    });

    if (!order) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    if (order.paymentStatus === 'paid') {
      return NextResponse.json({ success: true, message: 'Pesanan sudah dibayar', order });
    }

    const terminalStatuses = ['expired', 'cancelled', 'refunded'];
    if (terminalStatuses.includes(order.paymentStatus)) {
      return NextResponse.json(
        { error: `Pesanan tidak dapat dibayar karena status: ${order.paymentStatus}` },
        { status: 400 },
      );
    }

    const transactionId = `DUMMY-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const now = new Date();

    const updated = await prisma.productOrder.update({
      where: { publicToken },
      data: {
        paymentStatus: 'paid',
        orderStatus: 'processing',
        paymentType: paymentMethod || 'dummy_transfer',
        paidAt: now,
        updatedAt: now,
        metadata: {
          transaction_id: transactionId,
          transaction_status: 'SUCCESS',
          transaction_type: 'DUMMY',
          channel_id: paymentMethod || 'DUMMY_TRANSFER',
          dummy: true,
          paid_at: now.toISOString(),
        },
      },
    });

    console.log(`[DUMMY DOKU] Payment confirmed for ${order.invoiceNumber} (${publicToken})`);

    return NextResponse.json({
      success: true,
      message: 'Pembayaran berhasil dikonfirmasi (dummy)',
      transactionId,
      order: {
        invoiceNumber: updated.invoiceNumber,
        publicToken: updated.publicToken,
        paymentStatus: updated.paymentStatus,
        paidAt: updated.paidAt,
      },
    });
  } catch (error) {
    console.error('[DUMMY DOKU] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal memproses pembayaran' },
      { status: 500 },
    );
  }
}
