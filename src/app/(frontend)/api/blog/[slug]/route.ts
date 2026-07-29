import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';
import { normalizeStatus, normalizeStringArray, slugifyTitle, summarizeContent } from '@/lib/blog';

function resolvePublishedAt(input: unknown): Date | null {
  if (typeof input === 'string' && input.trim()) {
    const candidate = new Date(input);
    if (!Number.isNaN(candidate.getTime())) {
      return candidate;
    }
  }

  return null;
}

async function buildUniqueSlug(baseTitle: string, currentPostId: string): Promise<string> {
  const baseSlug = slugifyTitle(baseTitle) || `artikel-${Date.now()}`;

  const direct = await prisma.blogPost.findUnique({
    where: { slug: baseSlug },
    select: { id: true }
  });

  if (!direct || direct.id === currentPostId) {
    return baseSlug;
  }

  let counter = 2;
  while (counter < 5000) {
    const candidate = `${baseSlug}-${counter}`;
    const taken = await prisma.blogPost.findUnique({
      where: { slug: candidate },
      select: { id: true }
    });

    if (!taken || taken.id === currentPostId) {
      return candidate;
    }

    counter += 1;
  }

  return `${baseSlug}-${Date.now()}`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await requireAdmin();
    const { slug } = await params;

    const post = await prisma.blogPost.findUnique({
      where: { slug }
    });

    if (!post) {
      return NextResponse.json({ error: 'Blog post not found' }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('Error fetching blog post:', error);
    return NextResponse.json(
      { error: 'Failed to fetch blog post' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await requireAdmin();
    const { userId } = await auth();

    const { slug } = await params;

    const existing = await prisma.blogPost.findUnique({ where: { slug } });
    if (!existing) {
      return NextResponse.json({ error: 'Blog post not found' }, { status: 404 });
    }

    const body = await req.json();

    const title = String(body.title ?? existing.title).trim();
    const content = String(body.content ?? existing.content).trim();
    const nextStatus = normalizeStatus(body.status ?? existing.status);

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    const customSlug = String(body.slug || '').trim();
    const nextSlug = await buildUniqueSlug(customSlug || title, existing.id);

    const requestedPublishedAt = resolvePublishedAt(body.publishedAt);

    const post = await prisma.blogPost.update({
      where: { id: existing.id },
      data: {
        title,
        slug: nextSlug,
        excerpt: String(body.excerpt ?? existing.excerpt ?? '').trim() || summarizeContent(content),
        content,
        coverImage: String(body.coverImage ?? existing.coverImage ?? '').trim() || null,
        seoTitle: String(body.seoTitle ?? existing.seoTitle ?? '').trim() || null,
        seoDescription: String(body.seoDescription ?? existing.seoDescription ?? '').trim() || null,
        tags: normalizeStringArray(body.tags ?? existing.tags),
        relatedTreatmentSlugs: normalizeStringArray(body.relatedTreatmentSlugs ?? existing.relatedTreatmentSlugs),
        status: nextStatus,
        publishedAt: nextStatus === 'published'
          ? (requestedPublishedAt ?? existing.publishedAt ?? new Date())
          : null,
        updatedByClerkId: userId
      }
    });

    return NextResponse.json({ post });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('Error updating blog post:', error);
    return NextResponse.json(
      { error: 'Failed to update blog post' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await requireAdmin();
    const { userId } = await auth();

    const { slug } = await params;

    const existing = await prisma.blogPost.findUnique({ where: { slug } });
    if (!existing) {
      return NextResponse.json({ error: 'Blog post not found' }, { status: 404 });
    }

    await prisma.blogPost.delete({ where: { id: existing.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('Error deleting blog post:', error);
    return NextResponse.json(
      { error: 'Failed to delete blog post' },
      { status: 500 }
    );
  }
}
