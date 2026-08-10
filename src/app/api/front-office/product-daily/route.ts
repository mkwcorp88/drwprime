import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const showAll = searchParams.get('scope') === 'all';

    const where: Record<string, unknown> = {};

    if (date) {
      const [y, m, d] = date.split('-').map(Number);
      const start = new Date(Date.UTC(y, m - 1, d - 1, 17, 0, 0, 0));
      const end = new Date(Date.UTC(y, m - 1, d, 17, 0, 0, 0));
      where.createdAt = { gte: start, lt: end };
    } else if (!showAll) {
      const now = new Date();
      const utcHour = now.getUTCHours();
      const y = now.getUTCFullYear();
      const m = now.getUTCMonth();
      const d = now.getUTCDate();
      const wibD = utcHour >= 17 ? d + 1 : d;
      const start = new Date(Date.UTC(y, m, wibD - 1, 17, 0, 0, 0));
      const end = new Date(Date.UTC(y, m, wibD, 17, 0, 0, 0));
      where.createdAt = { gte: start, lt: end };
    }

    const orders = await prisma.productOrder.findMany({
      where,
      select: {
        id: true,
        invoiceNumber: true,
        customerName: true,
        customerPhone: true,
        shippingAddress: true,
        shippingCity: true,
        shippingProvince: true,
        shippingPostal: true,
        notes: true,
        totalAmount: true,
        paymentStatus: true,
        orderStatus: true,
        paidAt: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            productId: true,
            productName: true,
            productPrice: true,
            productSize: true,
            quantity: true,
            subtotal: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalPendapatan = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const paidOrders = orders.filter(o => o.paymentStatus === 'paid');
    const totalPaid = paidOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const pendingOrders = orders.filter(o => o.paymentStatus === 'pending');
    const failedOrders = orders.filter(o => ['failed', 'expired', 'cancelled'].includes(o.paymentStatus));

    const productSummary: Record<string, { name: string; quantity: number; revenue: number; discount: number }> = {};
    for (const order of paidOrders) {
      for (const item of order.items) {
        const key = item.productId;
        if (!productSummary[key]) {
          productSummary[key] = { name: item.productName, quantity: 0, revenue: 0, discount: 0 };
        }
        productSummary[key].quantity += item.quantity;
        productSummary[key].revenue += Number(item.subtotal);
      }
    }

    return NextResponse.json({
      orders,
      totals: {
        totalOrders: orders.length,
        totalPendapatan,
        totalPaid,
        totalDiscount: 0,
        totalListSubtotal: totalPaid,
        totalPending: pendingOrders.length,
        totalFailed: failedOrders.length,
        paidOrderCount: paidOrders.length,
      },
      productSummary: Object.entries(productSummary)
        .map(([id, data]) => ({ productId: id, ...data }))
        .sort((a, b) => b.revenue - a.revenue),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[Product Daily] Error fetching data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal mengambil data' },
      { status: 500 }
    );
  }
}
