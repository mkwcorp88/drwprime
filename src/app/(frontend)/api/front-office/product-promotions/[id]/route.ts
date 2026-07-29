import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const promotion = await prisma.productPromotion.findUnique({
      where: { id },
      include: { product: { select: { id: true, name: true, slug: true, price: true, imageUrl: true } } },
    });

    if (!promotion) return NextResponse.json({ error: 'Promo tidak ditemukan' }, { status: 404 });
    return NextResponse.json({ promotion });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[FO PROMOTIONS GET] error:', error);
    return NextResponse.json({ error: 'Gagal mengambil promo' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.productPromotion.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Promo tidak ditemukan' }, { status: 404 });

    const { title, badgeText, finalPrice, startsAt, endsAt, isActive } = body;
    const updateData: Record<string, unknown> = {};

    if (title !== undefined) updateData.title = title.trim();
    if (badgeText !== undefined) updateData.badgeText = badgeText?.trim() || null;
    if (finalPrice !== undefined) {
      const p = Number(finalPrice);
      if (Number.isNaN(p) || p < 0) return NextResponse.json({ error: 'Harga promo tidak valid' }, { status: 400 });
      const product = await prisma.product.findUnique({ where: { id: existing.productId } });
      if (product && p >= Number(product.price)) {
        return NextResponse.json({ error: 'Harga promo harus lebih rendah dari harga normal' }, { status: 400 });
      }
      updateData.finalPrice = p;
    }
    if (startsAt !== undefined) {
      const d = new Date(startsAt);
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'Format tanggal tidak valid' }, { status: 400 });
      updateData.startsAt = d;
    }
    if (endsAt !== undefined) {
      const d = new Date(endsAt);
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'Format tanggal tidak valid' }, { status: 400 });
      updateData.endsAt = d;
    }

    const checkStart = startsAt !== undefined ? new Date(startsAt) : existing.startsAt;
    const checkEnd = endsAt !== undefined ? new Date(endsAt) : existing.endsAt;
    if (checkEnd <= checkStart) {
      return NextResponse.json({ error: 'Tanggal selesai harus setelah tanggal mulai' }, { status: 400 });
    }

    const overlap = await prisma.productPromotion.findFirst({
      where: {
        id: { not: id },
        productId: existing.productId,
        isActive: true,
        startsAt: { lt: checkEnd },
        endsAt: { gt: checkStart },
      },
    });
    if (overlap) {
      return NextResponse.json({ error: 'Promo lain sudah aktif pada periode tersebut' }, { status: 409 });
    }

    if (isActive !== undefined) updateData.isActive = isActive;

    const promotion = await prisma.productPromotion.update({
      where: { id },
      data: updateData,
      include: { product: { select: { id: true, name: true, slug: true, price: true, imageUrl: true } } },
    });

    return NextResponse.json({ promotion, message: 'Promo berhasil diupdate' });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[FO PROMOTIONS PATCH] error:', error);
    const message = error instanceof Error ? error.message : 'Gagal mengupdate promo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const existing = await prisma.productPromotion.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Promo tidak ditemukan' }, { status: 404 });

    const hasOrders = await prisma.productOrderItem.findFirst({ where: { appliedPromotionId: id } });
    if (hasOrders) {
      await prisma.productPromotion.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({ message: 'Promo memiliki riwayat transaksi. Dinonaktifkan saja.' });
    }

    await prisma.productPromotion.delete({ where: { id } });
    return NextResponse.json({ message: 'Promo berhasil dihapus' });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[FO PROMOTIONS DELETE] error:', error);
    return NextResponse.json({ error: 'Gagal menghapus promo' }, { status: 500 });
  }
}
