import { NextRequest, NextResponse } from 'next/server';
import { uploadPublicObject, isUploadConfigured } from '@/lib/s3-upload';
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

    const safeName = sanitizeFileName(file.name || 'banner-image');
    const uploaded = await uploadPublicObject(`product-gallery-banners/${Date.now()}-${safeName}`, file);

    return NextResponse.json({ url: uploaded.url, pathname: uploaded.pathname });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') return handleAuthError(error);
    console.error('[FO BANNER UPLOAD] POST error:', error);
    return NextResponse.json({ error: 'Gagal upload gambar banner' }, { status: 500 });
  }
}
