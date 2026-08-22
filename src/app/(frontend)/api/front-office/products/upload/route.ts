import { NextRequest, NextResponse } from 'next/server';
import { uploadPublicObject, isUploadConfigured, deletePublicObject } from '@/lib/s3-upload';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/-+/g, '-');
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const formData = await req.formData();
    const file = formData.get('file');
    const productId = formData.get('productId');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File gambar wajib diisi' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Format gambar tidak didukung. Gunakan JPG, PNG, atau WEBP' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Ukuran file maksimal 10MB' }, { status: 400 });
    }

    if (!isUploadConfigured()) {
      return NextResponse.json({ error: 'Upload belum aktif' }, { status: 500 });
    }

    const safeName = sanitizeFileName(file.name || 'product-image');

    if (!productId || typeof productId !== 'string') {
      const key = `products/temp/${Date.now()}-${safeName}`;
      const uploaded = await uploadPublicObject(key, file);
      return NextResponse.json({ url: uploaded.url, pathname: uploaded.pathname });
    }

    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });
    }

    const key = `products/${productId}/${Date.now()}-${safeName}`;
    const uploaded = await uploadPublicObject(key, file);

    if (existing.imageKey && existing.imageKey.startsWith('products/')) {
      try { await deletePublicObject(existing.imageKey); } catch { /* non-critical */ }
    }

    await prisma.product.update({
      where: { id: productId },
      data: { imageUrl: uploaded.url, imageKey: uploaded.pathname, imageAlt: existing.name },
    });

    return NextResponse.json({ url: uploaded.url, pathname: uploaded.pathname, message: 'Upload gambar berhasil' });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[FO PRODUCTS UPLOAD] POST error:', error);
    const message = error instanceof Error ? error.message : 'Gagal upload gambar produk';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
