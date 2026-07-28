import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    let dateFilter: Date | undefined;
    let startFilter: Date | undefined;
    let endFilter: Date | undefined;

    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      dateFilter = d;
    } else if (startDate || endDate) {
      if (startDate) {
        startFilter = new Date(startDate);
        startFilter.setHours(0, 0, 0, 0);
      }
      if (endDate) {
        endFilter = new Date(endDate);
        endFilter.setHours(23, 59, 59, 999);
      }
    } else {
      // Default: today
      dateFilter = new Date();
      dateFilter.setHours(0, 0, 0, 0);
    }

    const where: Record<string, unknown> = {};
    if (dateFilter) {
      where.createdAt = { gte: dateFilter, lt: new Date(dateFilter.getTime() + 86400000) };
    } else if (startFilter || endFilter) {
      const createdAtFilter: Record<string, Date> = {};
      if (startFilter) createdAtFilter.gte = startFilter;
      if (endFilter) createdAtFilter.lte = endFilter;
      where.createdAt = createdAtFilter;
    }

    const orders = await prisma.productOrder.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    const totalPendapatan = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const paidOrders = orders.filter(o => o.paymentStatus === 'paid');
    const totalPaid = paidOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const pendingOrders = orders.filter(o => o.paymentStatus === 'pending');
    const failedOrders = orders.filter(o => ['failed', 'expired', 'cancelled'].includes(o.paymentStatus));

    // Product-level summary
    const productSummary: Record<string, { name: string; quantity: number; revenue: number }> = {};
    for (const order of orders) {
      for (const item of order.items) {
        const key = item.productId;
        if (!productSummary[key]) {
          productSummary[key] = { name: item.productName, quantity: 0, revenue: 0 };
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
        totalPending: pendingOrders.length,
        totalFailed: failedOrders.length,
      },
      productSummary: Object.entries(productSummary)
        .map(([id, data]) => ({ productId: id, ...data }))
        .sort((a, b) => b.revenue - a.revenue),
    });
  } catch (error) {
    console.error('[Product Daily] Error fetching data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal mengambil data' },
      { status: 500 }
    );
  }
}
