import { hash } from 'argon2';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { handleOpsError, readJson } from '@/lib/treatment-operations/http';
import { validateOpsPassword } from '@/lib/treatment-operations/password';
import { OpsError } from '@/lib/treatment-operations/utils';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireOpsStaff(['SUPER_ADMIN']);
    const { id } = await params;
    if (id === actor.id) throw new OpsError(422, 'Gunakan menu Pengaturan untuk mengganti password akun sendiri.');

    const body = await readJson(request);
    if (typeof body.password !== 'string') throw new OpsError(400, 'Password awal baru wajib diisi.');
    const passwordError = validateOpsPassword(body.password);
    if (passwordError) throw new OpsError(422, passwordError);

    const target = await prisma.opsStaff.findUnique({ where: { id } });
    if (!target || !target.active) throw new OpsError(404, 'Staf aktif tidak ditemukan.');

    const passwordHash = await hash(body.password);
    const resetAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.opsStaff.update({
        where: { id },
        data: {
          passwordHash,
          mustChangePassword: true,
          passwordChangedAt: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      await tx.opsSession.deleteMany({ where: { staffId: id } });
      await tx.opsAuditLog.create({
        data: {
          actorUserId: actor.id,
          branchId: target.branchId,
          entityType: 'STAFF_ACCOUNT',
          entityId: id,
          action: 'RESET_PASSWORD',
          afterData: { resetAt: resetAt.toISOString(), mustChangePassword: true },
        },
      });
    });

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleOpsError(error, 'reset staff password');
  }
}
