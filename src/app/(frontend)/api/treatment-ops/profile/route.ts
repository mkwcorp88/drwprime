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
      where: { phone, NOT: { id: staff.id } },
      select: { id: true },
    });
    if (owner) throw new OpsError(409, 'Nomor WhatsApp sudah dipakai akun staf lain.');

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.opsStaff.update({
        where: { id: staff.id },
        data: { phone },
        select: { id: true, phone: true },
      });
      await tx.opsLoginOtp.deleteMany({ where: { staffId: staff.id } });
      return result;
    });

    return NextResponse.json(serialize({ staff: updated }), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleOpsError(error, 'update profile');
  }
}
