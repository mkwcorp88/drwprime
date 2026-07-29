import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';
import { normalizeStatus, normalizeStringArray, slugifyTitle, summarizeContent } from '@/lib/blog';

function resolvePublishedAt(input: unknown): Date {
  if (typeof input === 'string' && input.trim()) {
    const candidate = new Date(input);
    if (!Number.isNaN(candidate.getTime())) {
      return candidate;
    }
  }

  return new Date();
}

async function buildUniqueSlug(baseTitle: string): Promise<string> {
  const baseSlug = slugifyTitle(baseTitle) || `artikel-${Date.now()}`;

  const existing = await prisma.blogPost.findUnique({
    where: { slug: baseSlug },
    select: { id: true }
  });

  if (!existing) {
    return baseSlug;
  }

  let counter = 2;
  while (counter < 5000) {
    const candidate = `${baseSlug}-${counter}`;
    const taken = await prisma.blogPost.findUnique({
      where: { slug: candidate },
      select: { id: true }
    });

    if (!taken) {
      return candidate;
    }

    counter += 1;
  }

  return `${baseSlug}-${Date.now()}`;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('q') || '').trim();
    const requestedStatus = searchParams.get('status') || 'published';
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 12), 1), 50);
    const page = Math.max(Number(searchParams.get('page') || 1), 1);
    const tag = (searchParams.get('tag') || '').trim();

    const where: Prisma.BlogPostWhereInput = {};

    if (requestedStatus === 'draft') {
      where.status = 'draft';
    } else if (requestedStatus === 'published') {
      where.status = 'published';
      where.publishedAt = { lte: new Date() };
    } else {
      where.status = 'published';
      where.publishedAt = { lte: new Date() };
    }

    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { excerpt: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } }
      ];
    }

    if (tag) {
      where.tags = { has: tag };
    }

    const [total, posts] = await Promise.all([
      prisma.blogPost.count({ where }),
      prisma.blogPost.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          coverImage: true,
          tags: true,
          status: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true
        }
      })
    ]);

    return NextResponse.json({
      posts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('Error fetching blog posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch blog posts' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const { userId } = await auth();

    const body = await req.json();

    const title = String(body.title || '').trim();
    const content = String(body.content || '').trim();

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    const status = normalizeStatus(body.status);
    const slug = await buildUniqueSlug(String(body.slug || title));
    const excerpt = String(body.excerpt || '').trim() || summarizeContent(content);

    const publishedAt = status === 'published' ? resolvePublishedAt(body.publishedAt) : null;

    const post = await prisma.blogPost.create({
      data: {
        title,
        slug,
        excerpt,
        content,
        coverImage: String(body.coverImage || '').trim() || null,
        seoTitle: String(body.seoTitle || '').trim() || null,
        seoDescription: String(body.seoDescription || '').trim() || null,
        tags: normalizeStringArray(body.tags),
        relatedTreatmentSlugs: normalizeStringArray(body.relatedTreatmentSlugs),
        status,
        publishedAt,
        createdByClerkId: userId,
        updatedByClerkId: userId
      }
    });

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('Error creating blog post:', error);
    return NextResponse.json(
      { error: 'Failed to create blog post' },
      { status: 500 }
    );
  }
}
