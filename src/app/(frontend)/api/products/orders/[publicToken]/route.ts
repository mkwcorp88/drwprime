import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ publicToken: string }> }
) {
  try {
    const { publicToken } = await params;

    const order = await prisma.productOrder.findUnique({
      where: { publicToken },
      select: {
        invoiceNumber: true,
        paymentStatus: true,
        orderStatus: true,
        totalAmount: true,
        paymentUrl: true,
        paidAt: true,
        createdAt: true,
        items: {
          select: {
            productName: true,
            productPrice: true,
            quantity: true,
            subtotal: true,
            productSize: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error('[Order Status] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
