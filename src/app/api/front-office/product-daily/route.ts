import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
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
    const totalDiscount = paidOrders.reduce((sum, o) => sum + Number(o.discountAmount || 0), 0);
    const totalListSubtotal = paidOrders.reduce((sum, o) => sum + Number(o.listSubtotal || Number(o.totalAmount)), 0);
    const pendingOrders = orders.filter(o => o.paymentStatus === 'pending');
    const failedOrders = orders.filter(o => ['failed', 'expired', 'cancelled'].includes(o.paymentStatus));

    const productSummary: Record<string, { name: string; quantity: number; revenue: number; discount: number }> = {};
    for (const order of paidOrders) {
      for (const item of order.items) {
        const key = item.catalogProductId || item.productId;
        if (!productSummary[key]) {
          productSummary[key] = { name: item.productName, quantity: 0, revenue: 0, discount: 0 };
        }
        productSummary[key].quantity += item.quantity;
        productSummary[key].revenue += Number(item.subtotal);
        productSummary[key].discount += Number(item.discountAmount || 0);
      }
    }

    return NextResponse.json({
      orders,
      totals: {
        totalOrders: orders.length,
        totalPendapatan,
        totalPaid,
        totalDiscount,
        totalListSubtotal,
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
