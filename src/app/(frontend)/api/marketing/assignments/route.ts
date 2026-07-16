import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { isValidType, isValidStatus, isValidPriority } from '@/lib/marketing';

// GET - List assignments with optional filters
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const priority = searchParams.get('priority');
    const assignee = searchParams.get('assignee');
    const search = searchParams.get('q');

    const where: Record<string, unknown> = {};
    if (status && status !== 'all') where.status = status;
    if (type && type !== 'all') where.type = type;
    if (priority && priority !== 'all') where.priority = priority;
    if (assignee === 'me') where.assigneeClerkId = userId;
    else if (assignee) where.assigneeClerkId = assignee;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const assignments = await prisma.marketingAssignment.findMany({
      where,
      include: { _count: { select: { comments: true } } },
      orderBy: [{ createdAt: 'desc' }],
    });

    return NextResponse.json({ success: true, assignments });
  } catch (error) {
    console.error('[MARKETING] Error listing assignments:', error);
    return NextResponse.json({ error: 'Gagal memuat assignment' }, { status: 500 });
  }
}

// POST - Create a new assignment
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await currentUser();
    const requesterName =
      [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
      user?.emailAddresses?.[0]?.emailAddress ||
      'Anonim';

    const body = await req.json();
    const {
      title,
      type,
      description,
      status,
      priority,
      progress,
      assigneeClerkId,
      assigneeName,
      assigneeEmail,
      dueDate,
      tags,
      attachments,
    } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Judul wajib diisi' }, { status: 400 });
    }
    if (type && !isValidType(type)) {
      return NextResponse.json({ error: 'Tipe tidak valid' }, { status: 400 });
    }
    if (status && !isValidStatus(status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 });
    }
    if (priority && !isValidPriority(priority)) {
      return NextResponse.json({ error: 'Prioritas tidak valid' }, { status: 400 });
    }

    const clampedProgress = Math.max(0, Math.min(100, Number(progress) || 0));

    const assignment = await prisma.marketingAssignment.create({
      data: {
        title: title.trim(),
        type: type || 'design_request',
        description: description?.trim() || null,
        status: status || 'todo',
        priority: priority || 'medium',
        progress: clampedProgress,
        assigneeClerkId: assigneeClerkId || null,
        assigneeName: assigneeName || null,
        assigneeEmail: assigneeEmail || null,
        requesterClerkId: userId,
        requesterName,
        dueDate: dueDate ? new Date(dueDate) : null,
        startedAt: status === 'in_progress' ? new Date() : null,
        completedAt: status === 'done' ? new Date() : null,
        tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
        attachments: Array.isArray(attachments) ? attachments.filter(Boolean) : [],
      },
    });

    return NextResponse.json({ success: true, assignment }, { status: 201 });
  } catch (error) {
    console.error('[MARKETING] Error creating assignment:', error);
    return NextResponse.json({ error: 'Gagal membuat assignment' }, { status: 500 });
  }
}
