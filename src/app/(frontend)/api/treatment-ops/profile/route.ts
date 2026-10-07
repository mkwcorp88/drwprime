import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { handleOpsError, readJson } from '@/lib/treatment-operations/http';
import { normalizeOpsPhone, validateOpsPhone } from '@/lib/treatment-operations/profile';
import { OpsError, serialize } from '@/lib/treatment-operations/utils';

export async function PATCH(request: Request) {
  try {
    const staff = await requireOpsStaff();
    const body = await readJson(request);
    if (typeof body.phone !== 'string') {
      throw new OpsError(400, 'Nomor WhatsApp wajib diisi.');
    }

    const phone = normalizeOpsPhone(body.phone);
    const phoneError = validateOpsPhone(body.phone);
    if (phoneError) throw new OpsError(422, phoneError);

    const owner = await prisma.opsStaff.findFirst({
      where: { NOT: { id: staff.id }, OR: [{ phone }, { username: phone }] },
      select: { id: true },
    });
    if (owner) throw new OpsError(409, 'Nomor WhatsApp sudah dipakai akun staf lain.');

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.opsStaff.update({
        where: { id: staff.id },
        data: { phone, username: phone },
        select: { id: true, phone: true },
      });
      await tx.opsLoginOtp.deleteMany({ where: { staffId: staff.id } });
      await tx.opsAuditLog.create({
        data: {
          actorUserId: staff.id,
          branchId: staff.branchId,
          entityType: 'STAFF_ACCOUNT',
          entityId: staff.id,
          action: 'UPDATE_WHATSAPP',
          afterData: { phone },
        },
      });
      return result;
    });

    return NextResponse.json(serialize({ staff: updated }), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return handleOpsError(new OpsError(409, 'Nomor WhatsApp sudah dipakai akun staf lain.'), 'update profile');
    }
    return handleOpsError(error, 'update profile');
  }
}
