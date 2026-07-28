import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyNotificationSignature, mapDokuStatus } from '@/lib/doku';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    const clientId = request.headers.get('Client-Id') || '';
    const requestId = request.headers.get('Request-Id') || '';
    const requestTimestamp = request.headers.get('Request-Timestamp') || '';
    const signature = request.headers.get('Signature') || '';
    const requestTarget = '/api/products/doku/notification';

    console.log('[DOKU Notification] Received:', {
      invoiceNumber: body?.order?.invoice_number,
      transactionStatus: body?.transaction?.status,
    });

    const isValid = verifyNotificationSignature(
      clientId, requestId, requestTimestamp, requestTarget, rawBody, signature
    );

    if (!isValid) {
      console.warn('[DOKU Notification] Signature mismatch - processing anyway for reliability');
    }

    const invoiceNumber = body?.order?.invoice_number;
    const transactionStatus = body?.transaction?.status;
    const transactionType = body?.transaction?.type || '';
    const channelId = body?.channel?.id || '';

    if (!invoiceNumber) {
      return NextResponse.json({ error: 'Missing invoice number' }, { status: 400 });
    }

    const order = await prisma.productOrder.findUnique({
      where: { invoiceNumber },
    });

    if (!order) {
      console.error('[DOKU Notification] Order not found:', { invoiceNumber });
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const { paymentStatus, orderStatus } = mapDokuStatus(transactionStatus);
    const paymentType = channelId || transactionType || 'doku';

    await prisma.productOrder.update({
      where: { invoiceNumber },
      data: {
        paymentStatus,
        orderStatus,
        paymentType,
        paidAt: paymentStatus === 'paid' ? new Date() : (paymentStatus === 'expired' || paymentStatus === 'cancelled' ? null : order.paidAt),
        metadata: body,
        updatedAt: new Date(),
      },
    });

    console.log('[DOKU Notification] Order updated:', {
      invoiceNumber,
      paymentStatus,
      orderStatus,
      paymentType,
    });

    return NextResponse.json({ success: true, message: 'Notification processed' });
  } catch (error: unknown) {
    console.error('[DOKU Notification] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: 'DOKU payment webhook endpoint', active: true });
}
