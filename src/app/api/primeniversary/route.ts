import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertMemberOrigin, memberError, memberJson } from '@/lib/member-auth/http';
import { normalizeLoginPhone } from '@/lib/member-auth/policy';
import { campaignPhase, IPL_PACKAGE_PRICE } from '@/lib/primeniversary';

export const dynamic = 'force-dynamic';

function result(code: string) {
  return NextResponse.json({ code }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  try {
    assertMemberOrigin(request);
    const body = await memberJson(request);
    const requestId = typeof body.requestId === 'string' ? body.requestId : '';
    const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
    const phone = normalizeLoginPhone(body.phone);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
      || name.length < 2 || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name)
      || (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
      || body.consent !== true) {
      return NextResponse.json({ error: 'Mohon lengkapi nama, nomor WhatsApp, email yang valid, dan persetujuan.' }, { status: 400 });
    }

    // A retry with the same id returns the original result, even after closing time.
    const existing = await prisma.primeniversaryRegistration.findUnique({ where: { requestId } });
    if (existing) {
      if (existing.patientName !== name || existing.patientPhone !== phone || (existing.patientEmail || '') !== email) {
        return NextResponse.json({ error: 'Data pendaftaran telah berubah. Muat ulang halaman untuk mendaftar.' }, { status: 409 });
      }
      return result(existing.code);
    }
    if (campaignPhase() !== 'open') {
      return NextResponse.json({ error: 'Pendaftaran hanya dibuka pada 11 November 2026, pukul 00.00–23.59 WIB.' }, { status: 403 });
    }

    try {
      const registration = await prisma.primeniversaryRegistration.create({
        data: {
          requestId,
          code: `IPL-${randomBytes(5).toString('hex').toUpperCase()}`,
          patientName: name,
          patientPhone: phone,
          patientEmail: email || null,
          price: IPL_PACKAGE_PRICE,
          consentAt: new Date(),
        },
      });
      return result(registration.code);
    } catch (error) {
      // Simultaneous retries may reach create before either one completes.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const duplicate = await prisma.primeniversaryRegistration.findUnique({ where: { requestId } });
        if (duplicate && duplicate.patientName === name && duplicate.patientPhone === phone && (duplicate.patientEmail || '') === email) return result(duplicate.code);
      }
      throw error;
    }
  } catch (error) {
    return memberError(error);
  }
}
