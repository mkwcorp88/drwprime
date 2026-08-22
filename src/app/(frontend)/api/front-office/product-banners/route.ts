import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';
import { deletePublicObject } from '@/lib/s3-upload';

export async function GET() {
  try {
    await requireAdmin();
    const banners = await prisma.productGalleryBanner.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json({ banners });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') return handleAuthError(error);
    console.error('[FO BANNERS] GET error:', error);
    return NextResponse.json({ error: 'Gagal memuat banner' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { title, imageDesktopUrl, imageDesktopKey, imageMobileUrl, imageMobileKey, imageAlt, heading, description, ctaText, ctaLink, sortOrder, isActive } = body;

    if (!title?.trim() || !imageDesktopUrl?.trim() || !imageDesktopKey?.trim() || !imageAlt?.trim()) {
      return NextResponse.json({ error: 'Judul, gambar desktop, dan alt text wajib diisi' }, { status: 400 });
    }

    if (ctaLink && !/^(https?:\/\/|\/)/.test(ctaLink.trim())) {
      return NextResponse.json({ error: 'Link CTA harus URL valid atau path internal' }, { status: 400 });
    }

    const banner = await prisma.productGalleryBanner.create({
      data: {
        title: title.trim(),
        imageDesktopUrl: imageDesktopUrl.trim(),
        imageDesktopKey: imageDesktopKey.trim(),
        imageMobileUrl: imageMobileUrl?.trim() || null,
        imageMobileKey: imageMobileKey?.trim() || null,
        imageAlt: imageAlt.trim(),
        heading: heading?.trim() || null,
        description: description?.trim() || null,
        ctaText: ctaText?.trim() || null,
        ctaLink: ctaLink?.trim() || null,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json({ banner, message: 'Banner berhasil dibuat' }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') return handleAuthError(error);
    console.error('[FO BANNERS] POST error:', error);
    return NextResponse.json({ error: 'Gagal membuat banner' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { id, title, imageDesktopUrl, imageDesktopKey, imageMobileUrl, imageMobileKey, imageAlt, heading, description, ctaText, ctaLink, sortOrder, isActive } = body;

    if (!id) return NextResponse.json({ error: 'Banner ID wajib diisi' }, { status: 400 });

    const existing = await prisma.productGalleryBanner.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Banner tidak ditemukan' }, { status: 404 });

    if (ctaLink && !/^(https?:\/\/|\/)/.test(ctaLink.trim())) {
      return NextResponse.json({ error: 'Link CTA harus URL valid atau path internal' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title.trim();
    if (imageDesktopUrl !== undefined) updateData.imageDesktopUrl = imageDesktopUrl.trim();
    if (imageDesktopKey !== undefined) {
      if (existing.imageDesktopKey && existing.imageDesktopKey !== imageDesktopKey.trim()) {
        try { await deletePublicObject(existing.imageDesktopKey); } catch { /* non-critical */ }
      }
      updateData.imageDesktopKey = imageDesktopKey.trim();
    }
    if (imageMobileUrl !== undefined) updateData.imageMobileUrl = imageMobileUrl?.trim() || null;
    if (imageMobileKey !== undefined) {
      if (existing.imageMobileKey && existing.imageMobileKey !== imageMobileKey?.trim()) {
        try { await deletePublicObject(existing.imageMobileKey!); } catch { /* non-critical */ }
      }
      updateData.imageMobileKey = imageMobileKey?.trim() || null;
    }
    if (imageAlt !== undefined) updateData.imageAlt = imageAlt.trim();
    if (heading !== undefined) updateData.heading = heading?.trim() || null;
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (ctaText !== undefined) updateData.ctaText = ctaText?.trim() || null;
    if (ctaLink !== undefined) updateData.ctaLink = ctaLink?.trim() || null;
    if (sortOrder !== undefined) updateData.sortOrder = Number.isFinite(sortOrder) ? sortOrder : 0;
    if (isActive !== undefined) updateData.isActive = isActive;

    const banner = await prisma.productGalleryBanner.update({ where: { id }, data: updateData });
    return NextResponse.json({ banner, message: 'Banner berhasil diupdate' });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') return handleAuthError(error);
    console.error('[FO BANNERS] PUT error:', error);
    return NextResponse.json({ error: 'Gagal mengupdate banner' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Banner ID wajib diisi' }, { status: 400 });

    const banner = await prisma.productGalleryBanner.findUnique({ where: { id } });
    if (!banner) return NextResponse.json({ error: 'Banner tidak ditemukan' }, { status: 404 });

    if (banner.imageDesktopKey) {
      try { await deletePublicObject(banner.imageDesktopKey); } catch { /* non-critical */ }
    }
    if (banner.imageMobileKey) {
      try { await deletePublicObject(banner.imageMobileKey!); } catch { /* non-critical */ }
    }

    await prisma.productGalleryBanner.delete({ where: { id } });
    return NextResponse.json({ message: 'Banner berhasil dihapus' });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') return handleAuthError(error);
    console.error('[FO BANNERS] DELETE error:', error);
    return NextResponse.json({ error: 'Gagal menghapus banner' }, { status: 500 });
  }
}
