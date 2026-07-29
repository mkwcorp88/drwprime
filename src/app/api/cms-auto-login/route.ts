import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { auth } from '@clerk/nextjs/server';
import { isHardcodedAdmin } from '@/lib/admin';

const COOKIE_NAME = 'payload-token';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://drwprime.com';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in?redirect_url=/cms', SITE_URL));
  }
  if (!isHardcodedAdmin(userId)) {
    return NextResponse.redirect(new URL('/', SITE_URL));
  }

  const adminEmail = process.env.CMS_ADMIN_EMAIL;
  const adminPassword = process.env.CMS_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error('[CMS AUTO-LOGIN] CMS_ADMIN_EMAIL dan CMS_ADMIN_PASSWORD wajib diset di environment.');
    return NextResponse.json(
      { error: 'Konfigurasi CMS belum lengkap. Hubungi administrator.' },
      { status: 500 },
    );
  }

  const payload = await getPayload({ config });

  try {
    const result = await payload.login({
      collection: 'users',
      data: { email: adminEmail, password: adminPassword },
    });

    const res = NextResponse.redirect(new URL('/cms', SITE_URL));
    res.cookies.set(COOKIE_NAME, result.token ?? '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });
    return res;
  } catch {
    return NextResponse.json(
      { error: 'Gagal auto-login CMS. Pastikan service account CMS sudah dibuat dan environment variable benar.' },
      { status: 500 },
    );
  }
}
