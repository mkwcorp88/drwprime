import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { prisma } from '@/lib/prisma';
import { requireMember } from '@/lib/member-auth/session';
import { MemberAuthError } from '@/lib/member-auth/policy';
import { assertMemberOrigin, memberError, memberResponse } from '@/lib/member-auth/http';
import { uploadPublicObject, deletePublicObject, isUploadConfigured } from '@/lib/s3-upload';

export async function POST(request: Request) {
  try {
    assertMemberOrigin(request);
    const user = await requireMember();
    if (!isUploadConfigured()) throw new MemberAuthError(503, 'Penyimpanan foto belum tersedia.', 'UPLOAD_UNAVAILABLE');
    if (Number(request.headers.get('content-length') || 0) > 6 * 1024 * 1024) throw new MemberAuthError(413, 'Ukuran foto maksimal 5 MB.', 'IMAGE_TOO_LARGE');
    const data = await request.formData();
    const file = data.get('file');
    if (!(file instanceof File) || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new MemberAuthError(400, 'Gunakan JPG, PNG, atau WebP maksimal 5 MB.', 'IMAGE_INVALID');
    let buffer: Buffer;
    try {
      buffer = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 20_000_000 }).rotate().resize(512, 512, { fit: 'cover' }).webp({ quality: 85 }).toBuffer();
    } catch { throw new MemberAuthError(400, 'File gambar tidak dapat dibaca.', 'IMAGE_INVALID'); }
    const key = `member-avatars/${user.id}/${randomUUID()}.webp`;
    const upload = await uploadPublicObject(key, new File([new Uint8Array(buffer)], 'avatar.webp', { type: 'image/webp' }));
    try {
      await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: upload.url, avatarKey: key } });
    } catch (error) {
      await deletePublicObject(key).catch(() => {});
      throw error;
    }
    if (user.avatarKey?.startsWith(`member-avatars/${user.id}/`)) await deletePublicObject(user.avatarKey).catch(() => {});
    return memberResponse({ imageUrl: upload.url });
  } catch (error) { return memberError(error); }
}
