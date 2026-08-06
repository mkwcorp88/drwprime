import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';
import { renderShippingLabelJpg, renderShippingLabelPdf, type ShippingLabelData } from '@/lib/shipping-label';

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  return Number(v ?? 0);
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const format = req.nextUrl.searchParams.get('format') || 'pdf';

    if (!['pdf', 'jpg'].includes(format)) {
      return NextResponse.json({ error: 'Format harus pdf atau jpg' }, { status: 400 });
    }

    const order = await prisma.productOrder.findUnique({
      where: { id },
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

    if (!order) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    if (order.paymentStatus !== 'paid') {
      return NextResponse.json({ error: `Pesanan belum lunas (status: ${order.paymentStatus})` }, { status: 409 });
    }

    if (['cancelled', 'refunded'].includes(order.orderStatus)) {
      return NextResponse.json({ error: `Pesanan ${order.orderStatus}` }, { status: 409 });
    }

    if (!order.customerName || !order.customerPhone || !order.shippingAddress || !order.shippingCity || !order.shippingProvince) {
      return NextResponse.json({ error: 'Data alamat penerima tidak lengkap' }, { status: 422 });
    }

    const wib = (d: Date | string | null) => {
      if (!d) return '-';
      const date = new Date(d);
      return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
    };

    const data: ShippingLabelData = {
      invoiceNumber: order.invoiceNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      shippingAddress: order.shippingAddress,
      shippingCity: order.shippingCity,
      shippingProvince: order.shippingProvince,
      shippingPostal: order.shippingPostal,
      items: order.items.map(i => ({ name: i.productName, size: i.productSize, quantity: i.quantity })),
      notes: order.notes,
      paidAt: wib(order.paidAt),
      generatedAt: wib(new Date()),
    };

    const safeInvoice = order.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');

    if (format === 'jpg') {
      const buf = await renderShippingLabelJpg(data);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Disposition': `attachment; filename="label-${safeInvoice}.jpg"`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    const buf = await renderShippingLabelPdf(data);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="label-${safeInvoice}.pdf"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') return handleAuthError(error);
    console.error('[SHIPPING LABEL] GET error:', error);
    return NextResponse.json({ error: 'Gagal membuat label' }, { status: 500 });
  }
}
