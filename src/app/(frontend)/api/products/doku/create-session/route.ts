import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createCheckoutPayment, generateInvoiceNumber } from '@/lib/doku';
import { normalizePhone } from '@/lib/phone';
import { resolveEffectivePriceForProduct } from '@/lib/products/pricing';
import crypto from 'crypto';

function generatePublicToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      items,
      customerName,
      customerPhone: rawPhone,
      customerEmail,
      shippingAddress,
      shippingCity,
      shippingProvince,
      shippingPostal,
      notes,
      idempotencyKey,
    } = body;
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

    if (!Array.isArray(items) || !items.every((i: unknown) => {
      const item = i as Record<string, unknown>;
      return item && typeof item.productId === 'string' && typeof item.quantity === 'number' && item.quantity > 0;
    })) {
      return NextResponse.json({ error: 'Format items tidak valid' }, { status: 400 });
    }

    const ikey = idempotencyKey?.trim() || null;
    if (ikey) {
      const dup = await prisma.productOrder.findUnique({ where: { idempotencyKey: ikey } });
      if (dup) {
        return NextResponse.json({
          success: true,
          paymentUrl: dup.paymentUrl,
          invoiceNumber: dup.invoiceNumber,
          duplicate: true,
        });
      }
    }

    const now = new Date();
    const pricingVersion = 1;
    let listSubtotal = 0;
    let discountAmount = 0;
    let totalAmount = 0;

    const orderItems = [];

    for (const item of items as { productId: string; quantity: number }[]) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { promotions: { where: { isActive: true }, orderBy: { startsAt: 'desc' } } },
      });

      if (!product || !product.isActive) {
        return NextResponse.json(
          { error: `Produk dengan ID ${item.productId} tidak ditemukan atau tidak aktif` },
          { status: 400 }
        );
      }

      const pricing = resolveEffectivePriceForProduct(Number(product.price), product.promotions, now);

      const unitPrice = pricing.effectivePrice;
      const itemSubtotal = unitPrice * item.quantity;
      const itemDiscount = (Number(product.price) - unitPrice) * item.quantity;

      orderItems.push({
        productId: product.name,
        productName: product.name,
        productPrice: unitPrice,
        productSize: product.size,
        productImage: product.imageUrl,
        quantity: item.quantity,
        subtotal: itemSubtotal,
        catalogProductId: product.id,
        originalPrice: Number(product.price),
        discountAmount: itemDiscount,
        appliedPromotionId: pricing.promotionId,
        appliedPromotionTitle: pricing.promotion?.title || null,
      });

      listSubtotal += Number(product.price) * item.quantity;
      discountAmount += itemDiscount;
      totalAmount += itemSubtotal;
    }

    const invoiceNumber = generateInvoiceNumber();
    const publicToken = generatePublicToken();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const returnUrl = `${appUrl}/product-gallery/order/${publicToken}`;
    const notificationUrl = `${appUrl}/api/products/doku/notification`;
    const dummyPaymentUrl = `${appUrl}/payment/${publicToken}`;

    const useDummy = process.env.USE_DUMMY_DOKU === 'true';
    let paymentUrl: string;
    let dokuTokenId: string | null = null;

    if (useDummy) {
      paymentUrl = dummyPaymentUrl;
      console.log(`[DUMMY DOKU] Using dummy payment URL for ${invoiceNumber}`);
    } else {
      const dokuResponse = await createCheckoutPayment({
        invoiceNumber,
        amount: totalAmount,
        items: orderItems.map(oi => ({
          name: oi.productName,
          price: oi.productPrice,
          quantity: oi.quantity,
        })),
        customerName: customerName.trim(),
        customerEmail: customerEmail?.trim() || `${customerPhone}@guest.drwprime.com`,
        customerPhone,
        notificationUrl,
        returnUrl,
      });
      paymentUrl = dokuResponse.response.payment.url;
      dokuTokenId = dokuResponse.response.payment.token_id;
    }

    await prisma.productOrder.create({
      data: {
        invoiceNumber,
        publicToken,
        idempotencyKey: ikey,
        customerName: customerName.trim(),
        customerPhone,
        customerEmail: customerEmail?.trim() || null,
        shippingAddress: shippingAddress?.trim() || null,
        shippingCity: shippingCity?.trim() || null,
        shippingProvince: shippingProvince?.trim() || null,
        shippingPostal: shippingPostal?.trim() || null,
        notes: notes?.trim() || null,
        totalAmount,
        listSubtotal,
        discountAmount,
        currency: 'IDR',
        pricingVersion,
        paymentStatus: 'pending',
        orderStatus: 'pending',
        paymentUrl,
        dokuTokenId,
        items: {
          create: orderItems,
        },
      },
    });

    return NextResponse.json({
      success: true,
      paymentUrl,
      invoiceNumber,
      publicToken,
    });
  } catch (error) {
    console.error('Error creating DOKU checkout:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal membuat sesi pembayaran' },
      { status: 500 }
    );
  }
}
