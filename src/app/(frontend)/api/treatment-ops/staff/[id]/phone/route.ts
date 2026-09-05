import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { handleOpsError, readJson } from '@/lib/treatment-operations/http';
import { normalizeOpsPhone, validateOpsPhone } from '@/lib/treatment-operations/profile';
import { OpsError } from '@/lib/treatment-operations/utils';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireOpsStaff(['SUPER_ADMIN']);
    const { id } = await params;
    const body = await readJson(request);
    if (typeof body.phone !== 'string') throw new OpsError(400, 'Nomor WhatsApp wajib diisi.');

    const phone = normalizeOpsPhone(body.phone);
    const phoneError = validateOpsPhone(body.phone);
    if (phoneError) throw new OpsError(422, phoneError);

    const target = await prisma.opsStaff.findUnique({ where: { id }, select: { id: true, branchId: true, active: true } });
    if (!target?.active) throw new OpsError(404, 'Staf aktif tidak ditemukan.');

    const owner = await prisma.opsStaff.findFirst({ where: { phone, NOT: { id } }, select: { id: true } });
    if (owner) throw new OpsError(409, 'Nomor WhatsApp sudah digunakan akun staf lain.');

    await prisma.$transaction(async (tx) => {
      await tx.opsStaff.update({ where: { id }, data: { phone } });
      await tx.opsLoginOtp.deleteMany({ where: { staffId: id } });
      await tx.opsAuditLog.create({
        data: {
          actorUserId: actor.id,
          branchId: target.branchId,
          entityType: 'STAFF_ACCOUNT',
          entityId: id,
          action: 'UPDATE_WHATSAPP',
          afterData: { phone },
        },
      });
    });

    return NextResponse.json({ ok: true, phone }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return handleOpsError(new OpsError(409, 'Nomor WhatsApp sudah digunakan akun staf lain.'), 'update staff WhatsApp');
    }
    return handleOpsError(error, 'update staff WhatsApp');
  }
}
