import { hash } from 'argon2';
import { PrismaClient } from '@prisma/client';
import { normalizeOpsEmail, validateOpsEmail, validateOpsPassword } from '../src/lib/treatment-operations/password';
import { normalizeOpsPhone, validateOpsPhone } from '../src/lib/treatment-operations/profile';

const prisma = new PrismaClient();

async function main() {
  const email = normalizeOpsEmail(process.env.OPS_ADMIN_EMAIL || '');
  const phoneInput = process.env.OPS_ADMIN_PHONE || '';
  const phone = normalizeOpsPhone(phoneInput);
  const password = process.env.OPS_ADMIN_PASSWORD || '';
  const employeeId = (process.env.OPS_ADMIN_EMPLOYEE_ID || 'SA-001').trim().toUpperCase();
  const name = (process.env.OPS_ADMIN_NAME || 'Super Admin DRW Prime').trim();
  const forceReset = process.env.OPS_ADMIN_FORCE_RESET === 'true';

  const emailError = validateOpsEmail(email);
  const phoneError = validateOpsPhone(phoneInput);
  const passwordError = validateOpsPassword(password);
  if (emailError) throw new Error(`OPS_ADMIN_EMAIL: ${emailError}`);
  if (phoneError) throw new Error(`OPS_ADMIN_PHONE: ${phoneError}`);
  if (passwordError) throw new Error(`OPS_ADMIN_PASSWORD: ${passwordError}`);

  const branch = await prisma.opsBranch.upsert({
    where: { code: 'DRW-UTAMA' },
    update: { name: 'DRW Prime Cabang Utama', active: true },
    create: { code: 'DRW-UTAMA', name: 'DRW Prime Cabang Utama', address: 'Indonesia' },
  });
  const existing = await prisma.opsStaff.findFirst({ where: { OR: [{ employeeId }, { email }] } });
  const phoneOwner = await prisma.opsStaff.findUnique({ where: { phone }, select: { id: true } });
  if (phoneOwner && phoneOwner.id !== existing?.id) throw new Error('OPS_ADMIN_PHONE sudah digunakan akun staf lain.');
  if (existing && !forceReset) {
    throw new Error('Akun Super Admin sudah ada. Gunakan OPS_ADMIN_FORCE_RESET=true hanya untuk pemulihan terkontrol.');
  }

  const passwordHash = await hash(password);
  const admin = await prisma.$transaction(async (tx) => {
    const staff = existing
      ? await tx.opsStaff.update({
          where: { id: existing.id },
          data: {
            branchId: branch.id,
            username: email,
            email,
            phone,
            employeeId,
            name,
            role: 'SUPER_ADMIN',
            active: true,
            passwordHash,
            mustChangePassword: true,
            passwordChangedAt: null,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        })
      : await tx.opsStaff.create({
          data: {
            branchId: branch.id,
            username: email,
            email,
            phone,
            employeeId,
            name,
            role: 'SUPER_ADMIN',
            passwordHash,
            mustChangePassword: true,
          },
        });

    await tx.opsSession.deleteMany({ where: { staffId: staff.id } });
    await tx.opsAuditLog.create({
      data: {
        actorUserId: staff.id,
        branchId: branch.id,
        entityType: 'STAFF_ACCOUNT',
        entityId: staff.id,
        action: existing ? 'BOOTSTRAP_RESET' : 'BOOTSTRAP_CREATE',
        afterData: { email, phone, employeeId, mustChangePassword: true },
      },
    });
    return staff;
  });

  console.log(`Super Admin siap: ${admin.email} (${admin.employeeId}). Password tidak ditampilkan.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
