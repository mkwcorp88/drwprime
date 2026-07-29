import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('product_id');
    const active = searchParams.get('active');

    const where: Record<string, unknown> = {};
    if (productId) where.productId = productId;
    if (active === 'true') {
      const now = new Date();
      where.isActive = true;
      where.startsAt = { lte: now };
      where.endsAt = { gt: now };
    } else if (active === 'false') {
      where.isActive = false;
    }

    const promotions = await prisma.productPromotion.findMany({
      where,
      include: { product: { select: { id: true, name: true, slug: true, price: true, imageUrl: true } } },
      orderBy: { startsAt: 'desc' },
    });

    return NextResponse.json({ promotions });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[FO PROMOTIONS] GET error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data promo' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { productId, title, badgeText, finalPrice, startsAt, endsAt } = body;

    if (!productId || !title?.trim()) {
      return NextResponse.json({ error: 'Produk dan judul promo wajib diisi' }, { status: 400 });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });
    }

    const parsedPrice = Number(finalPrice);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      return NextResponse.json({ error: 'Harga promo tidak valid' }, { status: 400 });
    }
    if (parsedPrice >= Number(product.price)) {
      return NextResponse.json({ error: 'Harga promo harus lebih rendah dari harga normal' }, { status: 400 });
    }

    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Format tanggal tidak valid' }, { status: 400 });
    }
    if (endDate <= startDate) {
      return NextResponse.json({ error: 'Tanggal selesai harus setelah tanggal mulai' }, { status: 400 });
    }

    const overlap = await prisma.productPromotion.findFirst({
      where: {
        productId,
        isActive: true,
        startsAt: { lt: endDate },
        endsAt: { gt: startDate },
      },
    });
    if (overlap) {
      return NextResponse.json({ error: 'Promo lain sudah aktif pada periode tersebut' }, { status: 409 });
    }

    const promotion = await prisma.productPromotion.create({
      data: {
        productId,
        title: title.trim(),
        badgeText: badgeText?.trim() || null,
        finalPrice: parsedPrice,
        startsAt: startDate,
        endsAt: endDate,
        isActive: true,
      },
      include: { product: { select: { id: true, name: true, slug: true, price: true, imageUrl: true } } },
    });

    return NextResponse.json({ promotion, message: 'Promo berhasil dibuat' }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[FO PROMOTIONS] POST error:', error);
    const message = error instanceof Error ? error.message : 'Gagal membuat promo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
