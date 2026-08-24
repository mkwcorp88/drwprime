import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyNotificationSignature, mapDokuStatus } from '@/lib/doku';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function timingSafeEqual(a: string, b: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    const clientId = request.headers.get('Client-Id') || '';
    const signature = request.headers.get('Signature') || '';
    const requestTimestamp = request.headers.get('Request-Timestamp') || '';
    const requestTarget = '/api/products/doku/notification';

    console.log('[DOKU Notification] Received');

    if (!clientId || !signature || !requestTimestamp) {
      console.warn('[DOKU Notification] Missing required headers');
      return NextResponse.json({ error: 'Missing required headers' }, { status: 401 });
    }

    const DOKU_CLIENT_ID = process.env.DOKU_CLIENT_ID || '';
    if (!timingSafeEqual(clientId, DOKU_CLIENT_ID)) {
      console.warn('[DOKU Notification] Client-Id mismatch');
      return NextResponse.json({ error: 'Invalid Client-Id' }, { status: 401 });
    }

    const now = Date.now();
    const ts = new Date(requestTimestamp).getTime();
    if (Number.isNaN(ts) || Math.abs(now - ts) > 5 * 60 * 1000) {
      console.warn('[DOKU Notification] Stale timestamp');
      return NextResponse.json({ error: 'Request timestamp out of tolerance' }, { status: 401 });
    }

    const isValid = verifyNotificationSignature(
      clientId, request.headers.get('Request-Id') || '', requestTimestamp, requestTarget, rawBody, signature
    );

    if (!isValid) {
      console.warn('[DOKU Notification] Signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const invoiceNumber = body?.order?.invoice_number;
    const transactionStatus = body?.transaction?.status;
    const transactionId = body?.transaction?.id || '';
    const channelId = body?.channel?.id || '';
    const transactionType = body?.transaction?.type || '';

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

    const allowedTransitions: Record<string, string[]> = {
      pending: ['pending', 'paid', 'failed', 'expired', 'cancelled', 'refunded'],
      paid: ['paid', 'refunded'],
      failed: ['failed'],
      expired: ['expired'],
      cancelled: ['cancelled'],
      refunded: ['refunded'],
    };
    if (!allowedTransitions[order.paymentStatus]?.includes(paymentStatus)) {
      console.warn('[DOKU Notification] Preventing regression:', {
        from: order.paymentStatus,
        to: paymentStatus,
      });
      return NextResponse.json({ success: true, message: 'Order already in terminal state' });
    }

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

    console.log('[DOKU Notification] Order updated:', { invoiceNumber, paymentStatus, orderStatus });

    return NextResponse.json({ success: true, message: 'Notification processed' });
  } catch (error: unknown) {
    console.error('[DOKU Notification] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: 'DOKU payment webhook endpoint', active: true });
}
