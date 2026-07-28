import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createCheckoutPayment, generateInvoiceNumber } from '@/lib/doku';
import { normalizePhone } from '@/lib/phone';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { items, customerName, customerPhone: rawPhone, customerEmail, shippingAddress, shippingCity, shippingProvince, shippingPostal, notes } = body;
    const customerPhone = normalizePhone(rawPhone);

    if (!customerName || !customerPhone || !items?.length) {
      return NextResponse.json(
        { error: 'Nama, telepon, dan minimal 1 produk wajib diisi' },
        { status: 400 }
      );
    }

    if (!shippingAddress || !shippingCity || !shippingProvince) {
      return NextResponse.json(
        { error: 'Alamat pengiriman wajib diisi' },
        { status: 400 }
      );
    }

    const totalAmount = items.reduce(
      (sum: number, item: { price: number; quantity: number }) =>
        sum + Math.round(item.price) * item.quantity,
      0
    );

    const invoiceNumber = generateInvoiceNumber();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const returnUrl = `${appUrl}/products?payment=done&invoice=${invoiceNumber}`;
    const notificationUrl = `${appUrl}/api/products/doku/notification`;

    const dokuResponse = await createCheckoutPayment({
      invoiceNumber,
      amount: totalAmount,
      items: items.map((item: { name: string; price: number; quantity: number }) => ({
        name: item.name,
        price: Math.round(item.price),
        quantity: item.quantity,
      })),
      customerName: customerName.trim(),
      customerEmail: customerEmail?.trim() || `${customerPhone}@guest.drwprime.com`,
      customerPhone,
      notificationUrl,
      returnUrl,
    });

    // Save order to database
    await prisma.productOrder.create({
      data: {
        invoiceNumber,
        customerName: customerName.trim(),
        customerPhone,
        customerEmail: customerEmail?.trim() || null,
        shippingAddress: shippingAddress?.trim() || null,
        shippingCity: shippingCity?.trim() || null,
        shippingProvince: shippingProvince?.trim() || null,
        shippingPostal: shippingPostal?.trim() || null,
        notes: notes?.trim() || null,
        totalAmount,
        paymentStatus: 'pending',
        orderStatus: 'pending',
        paymentUrl: dokuResponse.response.payment.url,
        dokuTokenId: dokuResponse.response.payment.token_id,
        items: {
          create: items.map((item: { name: string; price: number; quantity: number; size?: string; image?: string }) => ({
            productId: item.name,
            productName: item.name,
            productPrice: Math.round(item.price),
            productSize: item.size || null,
            productImage: item.image || null,
            quantity: item.quantity,
            subtotal: Math.round(item.price) * item.quantity,
          })),
        },
      },
    });

    return NextResponse.json({
      success: true,
      paymentUrl: dokuResponse.response.payment.url,
      invoiceNumber,
    });
  } catch (error) {
    console.error('Error creating DOKU checkout:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal membuat sesi pembayaran' },
      { status: 500 }
    );
  }
}
