import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { handleOpsError } from '@/lib/treatment-operations/http';
import { serialize } from '@/lib/treatment-operations/utils';

export async function GET() {
  try {
    const staff = await requireOpsStaff();
    const branchWhere = staff.role === 'SUPER_ADMIN' ? {} : { id: staff.branchId || '' };
    const [branches, treatments, doctors, therapists, patients] = await Promise.all([
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
        take: 100, orderBy: { name: 'asc' },
      }),
    ]);
    const safeStaff = {
      id: staff.id,
      branchId: staff.branchId,
      employeeId: staff.employeeId,
      name: staff.name,
      role: staff.role,
    };
    return NextResponse.json(serialize({ staff: safeStaff, branches, treatments, doctors, therapists, patients }));
  } catch (error) {
    return handleOpsError(error, 'bootstrap');
  }
}
