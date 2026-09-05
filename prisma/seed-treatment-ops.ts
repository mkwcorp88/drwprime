import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';

const prisma = new PrismaClient();

const actions = [
  ['Persiapan dan cleansing', true, 10, 3000],
  ['Ekstraksi', false, 10, 4000],
  ['Massage', true, 15, 7000],
  ['Aplikasi masker', true, 5, 2000],
  ['Angkat masker', true, 5, 2000],
  ['Finishing', true, 5, 2000],
] as const;

async function main() {
  const demoPasswordHash = await hash(process.env.OPS_DEMO_PASSWORD || 'PrimeDemo2026!');
  const branch = await prisma.opsBranch.upsert({
    where: { code: 'DRW-UTAMA' },
    update: { name: 'DRW Prime Cabang Utama', active: true },
    create: { code: 'DRW-UTAMA', name: 'DRW Prime Cabang Utama', address: 'Indonesia' },
  });

  const staff = [
    ['SA-001', 'superadmin', 'superadmin@drwprime.local', '628000000001', 'Super Admin Demo', 'SUPER_ADMIN'],
    ['MGT-001', 'manajemen', 'manajemen@drwprime.local', '628000000002', 'Manajemen Demo', 'MANAGEMENT'],
    ['FO-001', 'frontoffice', 'frontoffice@drwprime.local', '628000000003', 'Front Office Demo', 'FRONT_OFFICE'],
    ['SPV-001', 'supervisor', 'supervisor@drwprime.local', '628000000004', 'Supervisor Demo', 'SUPERVISOR'],
    ['TRP-001', 'terapisa', 'terapisa@drwprime.local', '628000000005', 'Terapis A', 'THERAPIST'],
    ['TRP-002', 'terapisb', 'terapisb@drwprime.local', '628000000006', 'Terapis B', 'THERAPIST'],
  ] as const;
  for (const [employeeId, username, email, phone, name, role] of staff) {
    await prisma.opsStaff.upsert({
      where: { employeeId },
      update: { branchId: branch.id, username, email, phone, name, role, active: true },
      create: { employeeId, username, email, phone, passwordHash: demoPasswordHash, branchId: branch.id, name, role, active: true, mustChangePassword: true },
    });
  }

  const doctorStaff = await prisma.opsStaff.upsert({
    where: { employeeId: 'DR-001' },
    update: { branchId: branch.id, username: 'dokter', email: 'dokter@drwprime.local', phone: '628000000007', name: 'dr. Prime Demo', role: 'DOCTOR', active: true },
    create: { employeeId: 'DR-001', username: 'dokter', email: 'dokter@drwprime.local', phone: '628000000007', passwordHash: demoPasswordHash, branchId: branch.id, name: 'dr. Prime Demo', role: 'DOCTOR', mustChangePassword: true },
  });
  await prisma.opsDoctor.upsert({
    where: { staffId: doctorStaff.id },
    update: { branchId: branch.id, name: doctorStaff.name, active: true },
    create: { staffId: doctorStaff.id, branchId: branch.id, name: doctorStaff.name },
  });

  const treatment = await prisma.opsTreatment.upsert({
    where: { code: 'FAC-BRIGHT' },
    update: { name: 'Facial Brightening', category: 'Facial', defaultPrice: 350000, active: true },
    create: { code: 'FAC-BRIGHT', name: 'Facial Brightening', category: 'Facial', defaultPrice: 350000 },
  });
  for (const [index, [actionName, isRequired, minutes, incentive]] of actions.entries()) {
    await prisma.opsTreatmentActionTemplate.upsert({
      where: { treatmentId_sequenceNumber: { treatmentId: treatment.id, sequenceNumber: index + 1 } },
      update: { actionName, isRequired, estimatedDurationMinutes: minutes, incentiveType: 'FIXED', incentiveValue: incentive, active: true },
      create: { treatmentId: treatment.id, actionName, sequenceNumber: index + 1, isRequired, estimatedDurationMinutes: minutes, incentiveType: 'FIXED', incentiveValue: incentive },
    });
  }

  await prisma.opsPatient.upsert({
    where: { patientNumber: 'P-DEMO-001' },
    update: { branchId: branch.id, name: 'Pasien Demo' },
    create: { patientNumber: 'P-DEMO-001', branchId: branch.id, name: 'Pasien Demo' },
  });
  console.log('Treatment operations seed completed.');
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(() => prisma.$disconnect());
