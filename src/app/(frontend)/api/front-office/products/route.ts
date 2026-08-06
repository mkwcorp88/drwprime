import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';
import { getAllProductsAdmin, getProductById } from '@/lib/products/catalog';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      const product = await getProductById(id);
      if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      return NextResponse.json({ product });
    }

    const products = await getAllProductsAdmin();
    return NextResponse.json({ products });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[FO PRODUCTS] GET error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data produk' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { name, slug, categoryId, description, price, size, headline, imageUrl, imageKey, imageAlt, benefits, usageInstructions, ctaText, classification, sortOrder, isActive } = body;

    if (!name?.trim() || !slug?.trim() || !categoryId || !description?.trim()) {
      return NextResponse.json({ error: 'Nama, slug, kategori, dan deskripsi wajib diisi' }, { status: 400 });
    }

    const parsedPrice = Number(price);
    if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      return NextResponse.json({ error: 'Harga harus lebih besar dari 0' }, { status: 400 });
    }

    const existingSlug = await prisma.product.findUnique({ where: { slug: slug.trim() } });
    if (existingSlug) {
      return NextResponse.json({ error: 'Slug sudah digunakan' }, { status: 409 });
    }

    const category = await prisma.productCategory.findUnique({ where: { id: categoryId } });
    if (!category) {
      return NextResponse.json({ error: 'Kategori tidak ditemukan' }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        categoryId,
        description: description.trim(),
        price: parsedPrice,
        size: size?.trim() || null,
        headline: headline?.trim() || null,
        imageUrl: imageUrl?.trim() || null,
        imageKey: imageKey?.trim() || null,
        imageAlt: imageAlt?.trim() || null,
        benefits: Array.isArray(benefits) ? benefits.filter(Boolean) : [],
        usageInstructions: usageInstructions?.trim() || null,
        ctaText: ctaText?.trim() || null,
        classification: classification?.trim() || null,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
        isActive: isActive ?? true,
      },
      include: { category: true, promotions: true },
    });

    return NextResponse.json({ product, message: 'Produk berhasil dibuat' }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[FO PRODUCTS] POST error:', error);
    const message = error instanceof Error ? error.message : 'Gagal membuat produk';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { id, name, slug, categoryId, description, price, size, headline, imageUrl, imageKey, imageAlt, benefits, usageInstructions, ctaText, classification, sortOrder, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'Product ID wajib diisi' }, { status: 400 });
    }

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name.trim();
    if (slug !== undefined) {
      const trimmedSlug = slug.trim().toLowerCase();
      if (trimmedSlug !== existing.slug) {
        const slugExists = await prisma.product.findUnique({ where: { slug: trimmedSlug } });
        if (slugExists) return NextResponse.json({ error: 'Slug sudah digunakan' }, { status: 409 });
      }
      updateData.slug = trimmedSlug;
    }
    if (categoryId !== undefined) {
      const cat = await prisma.productCategory.findUnique({ where: { id: categoryId } });
      if (!cat) return NextResponse.json({ error: 'Kategori tidak ditemukan' }, { status: 400 });
      updateData.categoryId = categoryId;
    }
    if (description !== undefined) updateData.description = description.trim();
    if (price !== undefined) {
      const p = Number(price);
      if (Number.isNaN(p) || p <= 0) return NextResponse.json({ error: 'Harga harus lebih besar dari 0' }, { status: 400 });
      updateData.price = p;
    }
    if (size !== undefined) updateData.size = size?.trim() || null;
    if (headline !== undefined) updateData.headline = headline?.trim() || null;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl?.trim() || null;
    if (imageKey !== undefined) updateData.imageKey = imageKey?.trim() || null;
    if (imageAlt !== undefined) updateData.imageAlt = imageAlt?.trim() || null;
    if (benefits !== undefined) updateData.benefits = Array.isArray(benefits) ? benefits.filter(Boolean) : [];
    if (usageInstructions !== undefined) updateData.usageInstructions = usageInstructions?.trim() || null;
    if (ctaText !== undefined) updateData.ctaText = ctaText?.trim() || null;
    if (classification !== undefined) updateData.classification = classification?.trim() || null;
    if (sortOrder !== undefined) updateData.sortOrder = Number.isFinite(sortOrder) ? sortOrder : 0;
    if (isActive !== undefined) updateData.isActive = isActive;

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: { category: true, promotions: true },
    });

    return NextResponse.json({ product, message: 'Produk berhasil diupdate' });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[FO PRODUCTS] PUT error:', error);
    const message = error instanceof Error ? error.message : 'Gagal mengupdate produk';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Product ID wajib diisi' }, { status: 400 });

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });

    const hasOrders = await prisma.productOrderItem.findFirst({ where: { catalogProductId: id } });
    if (hasOrders) {
      await prisma.product.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({ message: 'Produk memiliki riwayat transaksi. Dinonaktifkan saja.' });
    }

    if (product.imageKey) {
      try {
        const { deletePublicObject } = await import('@/lib/s3-upload');
        await deletePublicObject(product.imageKey);
      } catch { /* non-critical cleanup */ }
    }

    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ message: 'Produk berhasil dihapus' });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[FO PRODUCTS] DELETE error:', error);
    const message = error instanceof Error ? error.message : 'Gagal menghapus produk';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
