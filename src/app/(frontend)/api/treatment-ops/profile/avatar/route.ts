import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { handleOpsError } from '@/lib/treatment-operations/http';
import { OpsError, serialize } from '@/lib/treatment-operations/utils';
import { deletePublicObject, isUploadConfigured, uploadPublicObject } from '@/lib/s3-upload';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/-+/g, '-');
}

export async function POST(request: Request) {
  try {
    const staff = await requireOpsStaff();
    if (!isUploadConfigured()) {
      throw new OpsError(500, 'Upload belum aktif. Kredensial S3 belum dikonfigurasi.');
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) throw new OpsError(400, 'File foto wajib diisi.');
    if (!ALLOWED_TYPES.has(file.type)) {
      throw new OpsError(400, 'Format foto tidak didukung. Gunakan JPG, PNG, atau WEBP.');
    }
    if (file.size > MAX_FILE_SIZE) throw new OpsError(400, 'Ukuran foto maksimal 5MB.');

    const safeName = sanitizeFileName(file.name || 'avatar');
    const key = `ops-staff/${staff.id}/${Date.now()}-${safeName}`;
    const uploaded = await uploadPublicObject(key, file);

    if (staff.avatarKey && staff.avatarKey.startsWith('ops-staff/')) {
      try { await deletePublicObject(staff.avatarKey); } catch { /* non-critical */ }
    }

    await prisma.opsStaff.update({
      where: { id: staff.id },
      data: { avatarUrl: uploaded.url, avatarKey: uploaded.pathname },
    });

    return NextResponse.json(
      serialize({ url: uploaded.url, pathname: uploaded.pathname }),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return handleOpsError(error, 'upload avatar');
  }
}
