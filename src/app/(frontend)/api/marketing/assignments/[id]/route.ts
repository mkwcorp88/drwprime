import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { isValidType, isValidStatus, isValidPriority } from '@/lib/marketing';

// GET - Single assignment with comments
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const assignment = await prisma.marketingAssignment.findUnique({
      where: { id },
      include: { comments: { orderBy: { createdAt: 'asc' } } },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, assignment });
  } catch (error) {
    console.error('[MARKETING] Error fetching assignment:', error);
    return NextResponse.json({ error: 'Gagal memuat assignment' }, { status: 500 });
  }
}

// PATCH - Update an assignment
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.marketingAssignment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Assignment tidak ditemukan' }, { status: 404 });
    }

    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.title !== undefined) {
      if (!body.title?.trim()) {
        return NextResponse.json({ error: 'Judul wajib diisi' }, { status: 400 });
      }
      data.title = body.title.trim();
    }
    if (body.type !== undefined) {
      if (!isValidType(body.type)) {
        return NextResponse.json({ error: 'Tipe tidak valid' }, { status: 400 });
      }
      data.type = body.type;
    }
    if (body.priority !== undefined) {
      if (!isValidPriority(body.priority)) {
        return NextResponse.json({ error: 'Prioritas tidak valid' }, { status: 400 });
      }
      data.priority = body.priority;
    }
    if (body.description !== undefined) data.description = body.description?.trim() || null;
    if (body.assigneeClerkId !== undefined) data.assigneeClerkId = body.assigneeClerkId || null;
    if (body.assigneeName !== undefined) data.assigneeName = body.assigneeName || null;
    if (body.assigneeEmail !== undefined) data.assigneeEmail = body.assigneeEmail || null;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.tags !== undefined) {
      data.tags = Array.isArray(body.tags) ? body.tags.filter(Boolean) : [];
    }
    if (body.attachments !== undefined) {
      data.attachments = Array.isArray(body.attachments) ? body.attachments.filter(Boolean) : [];
    }
    if (body.progress !== undefined) {
      data.progress = Math.max(0, Math.min(100, Number(body.progress) || 0));
    }

    if (body.status !== undefined) {
      if (!isValidStatus(body.status)) {
        return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 });
      }
      data.status = body.status;
      if (body.status === 'in_progress' && !existing.startedAt) {
        data.startedAt = new Date();
      }
      if (body.status === 'done') {
        data.completedAt = new Date();
        if (body.progress === undefined) data.progress = 100;
      } else {
        data.completedAt = null;
      }
    }

    const assignment = await prisma.marketingAssignment.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, assignment });
  } catch (error) {
    console.error('[MARKETING] Error updating assignment:', error);
    return NextResponse.json({ error: 'Gagal memperbarui assignment' }, { status: 500 });
  }
}

// DELETE - Remove an assignment
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.marketingAssignment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Assignment tidak ditemukan' }, { status: 404 });
    }

    await prisma.marketingAssignment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[MARKETING] Error deleting assignment:', error);
    return NextResponse.json({ error: 'Gagal menghapus assignment' }, { status: 500 });
  }
}
