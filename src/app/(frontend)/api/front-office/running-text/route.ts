import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, handleAuthError } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  MAX_RUNNING_TEXT_LENGTH,
  RUNNING_TEXT_CACHE_TAG,
  RUNNING_TEXT_ID,
} from '@/lib/running-text';

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const text = typeof body.text === 'string' ? body.text.trim() : '';

    if (!text) {
      return NextResponse.json({ error: 'Running text wajib diisi' }, { status: 400 });
    }
    if (text.length > MAX_RUNNING_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Running text maksimal ${MAX_RUNNING_TEXT_LENGTH} karakter` },
        { status: 400 },
      );
    }

    const setting = await prisma.runningTextSetting.upsert({
      where: { id: RUNNING_TEXT_ID },
      update: { text },
      create: { id: RUNNING_TEXT_ID, text },
      select: { text: true },
    });

    revalidateTag(RUNNING_TEXT_CACHE_TAG);

    return NextResponse.json({
      text: setting.text,
      message: 'Running text berhasil disimpan',
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') return handleAuthError(error);
    console.error('[FO RUNNING TEXT] PUT error:', error);
    return NextResponse.json({ error: 'Gagal menyimpan running text' }, { status: 500 });
  }
}
