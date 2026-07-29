import { NextRequest, NextResponse } from 'next/server';
import { uploadPublicObject, isUploadConfigured } from '@/lib/s3-upload';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';

const MAX_FILE_SIZE = 8 * 1024 * 1024;
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
      return NextResponse.json({ error: 'File infografis wajib diisi' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Format file tidak didukung. Gunakan JPG, PNG, atau WEBP' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Ukuran file maksimal 8MB' },
        { status: 400 }
      );
    }

    if (!isUploadConfigured()) {
      return NextResponse.json(
        { error: 'Upload belum aktif. Kredensial S3 (S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY) belum dikonfigurasi di environment server.' },
        { status: 500 }
      );
    }

    const safeName = sanitizeFileName(file.name || 'prime-insight-image');
    const uploaded = await uploadPublicObject(`prime-insight/${Date.now()}-${safeName}`, file);

    return NextResponse.json({
      url: uploaded.url,
      pathname: uploaded.pathname,
      message: 'Upload infografis berhasil'
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[FO BLOG UPLOAD] POST error:', error);
    const message = error instanceof Error ? error.message : 'Gagal upload infografis';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
