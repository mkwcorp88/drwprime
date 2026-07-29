import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';

export async function GET() {
  try {
    await requireAdmin();
    const categories = await prisma.productCategory.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json({ categories });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[FO PRODUCT CATEGORIES] GET error:', error);
    return NextResponse.json({ error: 'Gagal mengambil kategori' }, { status: 500 });
  }
}

export async function POST() {
  try {
    await requireAdmin();
    return NextResponse.json({ error: 'Admin: gunakan API produk untuk mengelola produk' }, { status: 405 });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    return NextResponse.json({ error: 'Gagal membuat kategori' }, { status: 500 });
  }
}
