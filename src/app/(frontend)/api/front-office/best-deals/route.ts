import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';

type PromoPayload = {
  id?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  promoMonth?: string;
  validFrom?: string;
  validUntil?: string;
  ctaText?: string;
  ctaLink?: string;
  terms?: string;
  order?: number;
  isActive?: boolean;
};

function toOptionalDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET() {
  try {
    await requireAdmin();
    const promos = await prisma.bestDealPromo.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ promos });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[FO BEST DEALS] GET error:', error);
    return NextResponse.json({ error: 'Failed to load promos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = (await req.json()) as PromoPayload;

    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Judul promo wajib diisi' }, { status: 400 });
    }

    if (!body.promoMonth?.trim()) {
      return NextResponse.json({ error: 'Bulan promo wajib diisi' }, { status: 400 });
    }

    const promo = await prisma.bestDealPromo.create({
      data: {
        title: body.title.trim(),
        subtitle: body.subtitle?.trim() || null,
        description: body.description?.trim() || null,
        imageUrl: body.imageUrl?.trim() || null,
        promoMonth: body.promoMonth.trim(),
        validFrom: toOptionalDate(body.validFrom),
        validUntil: toOptionalDate(body.validUntil),
        ctaText: body.ctaText?.trim() || 'Reservasi Sekarang',
        ctaLink: body.ctaLink?.trim() || '/reservation',
        terms: body.terms?.trim() || null,
        order: Number.isFinite(body.order) ? Number(body.order) : 0,
        isActive: body.isActive ?? true,
      },
    });

    return NextResponse.json({ promo, message: 'Promo berhasil diupload' });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[FO BEST DEALS] POST error:', error);
    return NextResponse.json({ error: 'Failed to create promo' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin();
    const body = (await req.json()) as PromoPayload;

    if (!body.id) {
      return NextResponse.json({ error: 'Promo ID wajib diisi' }, { status: 400 });
    }

    const promo = await prisma.bestDealPromo.update({
      where: { id: body.id },
      data: {
        title: body.title !== undefined ? body.title.trim() : undefined,
        subtitle: body.subtitle !== undefined ? body.subtitle.trim() || null : undefined,
        description: body.description !== undefined ? body.description.trim() || null : undefined,
        imageUrl: body.imageUrl !== undefined ? body.imageUrl.trim() || null : undefined,
        promoMonth: body.promoMonth !== undefined ? body.promoMonth.trim() : undefined,
        validFrom: body.validFrom !== undefined ? toOptionalDate(body.validFrom) : undefined,
        validUntil: body.validUntil !== undefined ? toOptionalDate(body.validUntil) : undefined,
        ctaText:
          body.ctaText !== undefined
            ? body.ctaText.trim() || 'Reservasi Sekarang'
            : undefined,
        ctaLink:
          body.ctaLink !== undefined
            ? body.ctaLink.trim() || '/reservation'
            : undefined,
        terms: body.terms !== undefined ? body.terms.trim() || null : undefined,
        order: body.order !== undefined ? Number(body.order) || 0 : undefined,
        isActive: body.isActive,
      },
    });

    return NextResponse.json({ promo, message: 'Promo berhasil diupdate' });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[FO BEST DEALS] PUT error:', error);
    return NextResponse.json({ error: 'Failed to update promo' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Promo ID wajib diisi' }, { status: 400 });
    }

    await prisma.bestDealPromo.delete({ where: { id } });

    return NextResponse.json({ message: 'Promo berhasil dihapus' });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[FO BEST DEALS] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete promo' }, { status: 500 });
  }
}
