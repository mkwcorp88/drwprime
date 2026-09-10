import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, handleAuthError } from '@/lib/auth';

/**
 * Normalisasi nomor untuk export Cekat.
 * Lebih toleran daripada normalizePhone(): buang SEMUA non-digit,
 * ambil nomor pertama bila satu field berisi beberapa nomor
 * ("0812.../0813...", "0812, 0813"), dan samakan ke format 62...
 */
function normalizeForExport(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const first = trimmed.split(/[/;,|]/)[0].trim();
  const digits = first.replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  return `62${digits}`;
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

export async function GET() {
  try {
    await requireAdmin();

    const users = await prisma.user.findMany({
      select: {
        firstName: true,
        lastName: true,
        phone: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    const headers = ['phone_number', 'name'];
    const seenPhones = new Set<string>();

    const rows = users.flatMap((user) => {
      const phone = normalizeForExport(user.phone);
      if (!/^62\d{8,13}$/.test(phone) || seenPhones.has(phone)) return [];
      seenPhones.add(phone);

      return [[
        phone,
        [user.firstName, user.lastName].filter(Boolean).join(' '),
      ]];
    });

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada member dengan nomor WhatsApp yang valid untuk diekspor.' },
        { status: 422 },
      );
    }

    const csv = [headers, ...rows]
      .map((row) => row.map(csvCell).join(','))
      .join('\r\n');
    const date = new Date().toISOString().slice(0, 10);
    const skipped = users.length - rows.length;

    return new NextResponse(`\uFEFF${csv}\r\n`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="drwprime-members-cekat-${date}.csv"`,
        'Cache-Control': 'no-store',
        'X-Export-Total': String(users.length),
        'X-Export-Exported': String(rows.length),
        'X-Export-Skipped': String(skipped),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return handleAuthError(error);
    }
    console.error('[MEMBERS-EXPORT] Error:', error);
    return NextResponse.json({ error: 'Gagal mengekspor data member' }, { status: 500 });
  }
}
