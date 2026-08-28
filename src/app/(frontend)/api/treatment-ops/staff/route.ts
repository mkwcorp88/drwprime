import { NextResponse } from 'next/server';
import { hash } from 'argon2';
import { Prisma, type OpsRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { OPS_ROLES } from '@/lib/treatment-operations/constants';
import { handleOpsError, readJson } from '@/lib/treatment-operations/http';
import { normalizeOpsEmail, validateOpsEmail, validateOpsPassword } from '@/lib/treatment-operations/password';
import { OpsError, serialize } from '@/lib/treatment-operations/utils';

export async function GET() {
  try {
    const actor = await requireOpsStaff(['SUPER_ADMIN', 'MANAGEMENT']);
    const [staff, branches] = await Promise.all([
      prisma.opsStaff.findMany({
        where: actor.role === 'SUPER_ADMIN' ? {} : { branchId: actor.branchId || '' },
        select: {
          id: true, branchId: true, employeeId: true, name: true, email: true, role: true,
          active: true, mustChangePassword: true, passwordChangedAt: true, lastLoginAt: true,
          badgeIssuedAt: true,
          branch: { select: { name: true } },
        },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      }),
      prisma.opsBranch.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    return NextResponse.json(serialize({ staff, branches }));
  } catch (error) {
    return handleOpsError(error, 'list staff');
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireOpsStaff(['SUPER_ADMIN']);
    const body = await readJson(request);
    if (
      typeof body.email !== 'string' || typeof body.password !== 'string' ||
      typeof body.employeeId !== 'string' || typeof body.name !== 'string' ||
      typeof body.role !== 'string'
    ) {
      throw new OpsError(400, 'Email, password awal, ID karyawan, nama, dan role wajib diisi.');
    }

    const email = normalizeOpsEmail(body.email);
    const emailError = validateOpsEmail(email);
    if (emailError) throw new OpsError(422, emailError);
    const passwordError = validateOpsPassword(body.password);
    if (passwordError) throw new OpsError(422, passwordError);

    const employeeId = body.employeeId.trim().toUpperCase();
    const name = body.name.trim();
    if (!employeeId || employeeId.length > 40) throw new OpsError(422, 'ID karyawan tidak valid.');
    if (name.length < 2 || name.length > 120) throw new OpsError(422, 'Nama staf tidak valid.');
    if (!OPS_ROLES.includes(body.role as OpsRole)) throw new OpsError(422, 'Role staf tidak valid.');

    const role = body.role as OpsRole;
    const branchId = typeof body.branchId === 'string' && body.branchId.trim() ? body.branchId.trim() : null;
    if (role !== 'SUPER_ADMIN' && !branchId) throw new OpsError(422, 'Cabang wajib dipilih untuk role ini.');

    if (branchId) {
      const branch = await prisma.opsBranch.findFirst({ where: { id: branchId, active: true }, select: { id: true } });
      if (!branch) throw new OpsError(404, 'Cabang aktif tidak ditemukan.');
    }

    const existing = await prisma.opsStaff.findFirst({
      where: { OR: [{ email }, { employeeId }, { username: email }] },
      select: { email: true, employeeId: true },
    });
    if (existing?.email === email) throw new OpsError(409, 'Email sudah digunakan akun staf lain.');
    if (existing) throw new OpsError(409, 'ID karyawan sudah digunakan akun staf lain.');

    const passwordHash = await hash(body.password);
    const staff = await prisma.$transaction(async (tx) => {
      const created = await tx.opsStaff.create({
        data: {
          branchId,
          username: email,
          passwordHash,
          mustChangePassword: true,
          employeeId,
          name,
          email,
          role,
        },
      });
      if (role === 'DOCTOR' && branchId) {
        await tx.opsDoctor.create({ data: { branchId, staffId: created.id, name } });
      }
      await tx.opsAuditLog.create({
        data: {
          actorUserId: actor.id,
          branchId,
          entityType: 'STAFF_ACCOUNT',
          entityId: created.id,
          action: 'CREATE',
          afterData: { email, employeeId, name, role, branchId, mustChangePassword: true },
        },
      });
      return created;
    });

    return NextResponse.json({
      staff: { id: staff.id, branchId: staff.branchId, employeeId: staff.employeeId, name: staff.name, email: staff.email, role: staff.role },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return handleOpsError(new OpsError(409, 'Email atau ID karyawan sudah digunakan.'), 'create staff');
    }
    return handleOpsError(error, 'create staff');
  }
}
