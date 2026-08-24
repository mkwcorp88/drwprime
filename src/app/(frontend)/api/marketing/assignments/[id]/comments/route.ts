import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';

// POST - Add a comment to an assignment
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { clerkUserId: userId } = await requireAdmin();

    const { id } = await params;
    const assignment = await prisma.marketingAssignment.findUnique({ where: { id } });
    if (!assignment) {
      return NextResponse.json({ error: 'Assignment tidak ditemukan' }, { status: 404 });
    }

    const body = await req.json();
    if (!body.body?.trim()) {
      return NextResponse.json({ error: 'Komentar tidak boleh kosong' }, { status: 400 });
    }

    const user = await currentUser();
    const authorName =
      [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
      user?.emailAddresses?.[0]?.emailAddress ||
      'Anonim';

    const comment = await prisma.marketingComment.create({
      data: {
        assignmentId: id,
        authorClerkId: userId,
        authorName,
        body: body.body.trim(),
      },
    });

    return NextResponse.json({ success: true, comment }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') return handleAuthError(error);
    console.error('[MARKETING] Error adding comment:', error);
    return NextResponse.json({ error: 'Gagal menambahkan komentar' }, { status: 500 });
  }
}
