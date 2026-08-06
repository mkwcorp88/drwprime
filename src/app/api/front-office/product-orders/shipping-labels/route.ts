import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';
import { renderShippingLabelsBatch, type ShippingLabelData } from '@/lib/shipping-label';

const MAX_BATCH = 50;

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json().catch(() => null);
    const orderIds: string[] = (body?.orderIds || [])
      .filter((id: unknown) => typeof id === 'string' && id.length > 0);

    const uniqueIds = [...new Set(orderIds)];

    if (uniqueIds.length === 0) {
      return NextResponse.json({ error: 'orderIds wajib diisi' }, { status: 400 });
    }

    if (uniqueIds.length > MAX_BATCH) {
      return NextResponse.json({ error: `Maksimal ${MAX_BATCH} label per batch` }, { status: 400 });
    }

    const orders = await prisma.productOrder.findMany({
      where: { id: { in: uniqueIds } },
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
        paymentStatus: true,
        orderStatus: true,
        paidAt: true,
        items: {
          select: {
            productName: true,
            productSize: true,
            quantity: true,
          },
        },
      },
    });

    const orderMap = new Map(orders.map(o => [o.id, o]));
    const invalidOrders: { id: string; reason: string }[] = [];

    for (const id of uniqueIds) {
      const o = orderMap.get(id);
      if (!o) { invalidOrders.push({ id, reason: 'Pesanan tidak ditemukan' }); continue; }
      if (o.paymentStatus !== 'paid') { invalidOrders.push({ id, reason: `Belum lunas (${o.paymentStatus})` }); continue; }
      if (['cancelled', 'refunded'].includes(o.orderStatus)) { invalidOrders.push({ id, reason: `Status: ${o.orderStatus}` }); continue; }
      if (!o.customerName || !o.customerPhone || !o.shippingAddress || !o.shippingCity || !o.shippingProvince) {
        invalidOrders.push({ id, reason: 'Alamat penerima tidak lengkap' });
      }
    }

    if (invalidOrders.length > 0) {
      return NextResponse.json({ error: 'Beberapa pesanan tidak valid', invalidOrders }, { status: 422 });
    }

    const wib = (d: Date | string | null) => {
      if (!d) return '-';
      const date = new Date(d);
      return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
    };

    const dataList: ShippingLabelData[] = uniqueIds.map(id => {
      const o = orderMap.get(id)!;
      return {
        invoiceNumber: o.invoiceNumber,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        shippingAddress: o.shippingAddress!,
        shippingCity: o.shippingCity!,
        shippingProvince: o.shippingProvince!,
        shippingPostal: o.shippingPostal,
        items: o.items.map(i => ({ name: i.productName, size: i.productSize, quantity: i.quantity })),
        notes: o.notes,
        paidAt: wib(o.paidAt),
        generatedAt: wib(new Date()),
      };
    });

    const buf = await renderShippingLabelsBatch(dataList);

    const now = new Date();
    const ts = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(now).replace(/[/: ]/g, '').replace(/,/g, '-');

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="shipping-labels-${ts}-WIB.pdf"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') return handleAuthError(error);
    console.error('[SHIPPING LABELS BATCH] POST error:', error);
    return NextResponse.json({ error: 'Gagal membuat label batch' }, { status: 500 });
  }
}
