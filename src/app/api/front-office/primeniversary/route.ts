import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthError, handleAuthError, requireAdmin } from '@/lib/auth';
import { assertStaffOrigin, staffError, staffJson } from '@/lib/staff-auth/http';
import { displayPackageStatus, packageExpiry } from '@/lib/primeniversary';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const params = new URL(request.url).searchParams;
    const search = (params.get('search') || '').trim().slice(0, 100);
    const status = params.get('status') || 'all';
    const parsedPage = Number(params.get('page'));
    const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 10000) : 1;
    const pageSize = 15;
    const now = new Date();
    const where: Prisma.PrimeniversaryRegistrationWhereInput = {};
    const phoneSearch = search.replace(/\D/g, '');
    const normalizedPhoneSearch = phoneSearch.startsWith('0') ? `62${phoneSearch.slice(1)}` : phoneSearch;
    if (search) where.OR = [
      { patientName: { contains: search, mode: 'insensitive' } },
      { patientPhone: { contains: normalizedPhoneSearch || search } },
      { code: { contains: search, mode: 'insensitive' } },
    ];
    if (status === 'pending' || status === 'cancelled') where.status = status;
    if (status === 'active') { where.status = 'active'; where.expiresAt = { gt: now }; }
    if (status === 'expired') { where.status = 'active'; where.expiresAt = { lte: now }; }

    const [registrations, filteredTotal, total, pending, active, paid] = await Promise.all([
      prisma.primeniversaryRegistration.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize,
        select: { id: true, code: true, patientName: true, patientPhone: true, patientEmail: true, price: true, status: true, createdAt: true, paidAt: true, expiresAt: true } }),
      prisma.primeniversaryRegistration.count({ where }),
      prisma.primeniversaryRegistration.count(),
      prisma.primeniversaryRegistration.count({ where: { status: 'pending' } }),
      prisma.primeniversaryRegistration.count({ where: { status: 'active', expiresAt: { gt: now } } }),
      prisma.primeniversaryRegistration.aggregate({ where: { status: 'active' }, _sum: { price: true }, _count: true }),
    ]);
    return NextResponse.json({
      registrations: registrations.map((entry) => ({ ...entry, status: displayPackageStatus(entry.status, entry.expiresAt, now) })),
      summary: { total, pending, active, paidCount: paid._count, paidAmount: paid._sum.price || 0 },
      page, pageSize, filteredTotal,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const staff = await requireAdmin();
    assertStaffOrigin(request);
    const body = await staffJson(request);
    const id = typeof body.id === 'string' && body.id.length <= 100 ? body.id : '';
    const action = body.action;
    if (!id || (action !== 'confirm_payment' && action !== 'cancel')) {
      return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 });
    }
    const now = new Date();
    const data = action === 'confirm_payment'
      ? { status: 'active', paidAt: now, expiresAt: packageExpiry(now), confirmedBy: staff.staffId }
      : { status: 'cancelled', cancelledAt: now, cancelledBy: staff.staffId };
    // Conditional update makes simultaneous confirmations safe and never extends ED.
    const updated = await prisma.primeniversaryRegistration.updateMany({ where: { id, status: 'pending' }, data });
    if (!updated.count) return NextResponse.json({ error: 'Pendaftaran sudah diproses atau tidak ditemukan. Muat ulang tabel.' }, { status: 409 });
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return error instanceof AuthError ? handleAuthError(error) : staffError(error);
  }
}
