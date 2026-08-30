import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { handleOpsError } from '@/lib/treatment-operations/http';
import { serialize } from '@/lib/treatment-operations/utils';

export async function GET() {
  try {
    const staff = await requireOpsStaff();
    const branchWhere = staff.role === 'SUPER_ADMIN' ? {} : { id: staff.branchId || '' };
    const staffBranch = staff.branchId
      ? await prisma.opsBranch.findUnique({ where: { id: staff.branchId }, select: { id: true, name: true } })
      : null;
    const [branches, treatments, doctors, therapists, patients, assignableStaff] = await Promise.all([
      prisma.opsBranch.findMany({ where: { ...branchWhere, active: true }, orderBy: { name: 'asc' } }),
      prisma.opsTreatment.findMany({
        where: { active: true },
        include: { actionTemplates: { where: { active: true }, orderBy: { sequenceNumber: 'asc' } } },
        orderBy: { name: 'asc' },
      }),
      prisma.opsDoctor.findMany({
        where: { ...(staff.role === 'SUPER_ADMIN' ? {} : { branchId: staff.branchId || '' }), active: true },
        orderBy: { name: 'asc' },
      }),
      prisma.opsStaff.findMany({
        where: { ...(staff.role === 'SUPER_ADMIN' ? {} : { branchId: staff.branchId || '' }), role: 'THERAPIST', active: true },
        select: { id: true, branchId: true, employeeId: true, name: true }, orderBy: { name: 'asc' },
      }),
      prisma.opsPatient.findMany({
        where: staff.role === 'SUPER_ADMIN' ? {} : { branchId: staff.branchId || '' },
        select: { id: true, branchId: true, patientNumber: true, name: true, source: true },
        take: 100, orderBy: { name: 'asc' },
      }),
      prisma.opsStaff.findMany({
        where: {
          ...(staff.role === 'SUPER_ADMIN' ? {} : { branchId: staff.branchId || '' }),
          role: { in: ['THERAPIST', 'DOCTOR', 'APOTEKER', 'ASISTEN_APOTEKER', 'PERAWAT'] }, active: true,
        },
        select: { id: true, branchId: true, employeeId: true, name: true, role: true }, orderBy: { name: 'asc' },
      }),
    ]);
    const safeStaff = {
      id: staff.id,
      branchId: staff.branchId,
      employeeId: staff.employeeId,
      name: staff.name,
      email: staff.email,
      phone: staff.phone,
      avatarUrl: staff.avatarUrl,
      role: staff.role,
      branch: staffBranch,
    };
    return NextResponse.json(serialize({ staff: safeStaff, branches, treatments, doctors, therapists, patients, assignableStaff }));
  } catch (error) {
    return handleOpsError(error, 'bootstrap');
  }
}
