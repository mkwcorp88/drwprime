import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { ORDER_MANAGEMENT_ROLES } from '@/lib/treatment-operations/constants';
import { handleOpsError, readJson } from '@/lib/treatment-operations/http';
import { OpsError } from '@/lib/treatment-operations/utils';

export async function POST(request: Request) {
  try {
    const actor = await requireOpsStaff(ORDER_MANAGEMENT_ROLES);
    const body = await readJson(request);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const branchId = typeof body.branchId === 'string' ? body.branchId : actor.branchId;
    if (!name || !branchId) throw new OpsError(400, 'Nama pasien dan cabang wajib diisi.');
    if (actor.role !== 'SUPER_ADMIN' && actor.branchId !== branchId) throw new OpsError(403, 'Cabang tidak diizinkan.');
    const sequence = await prisma.opsPatient.count({ where: { branchId } });
    const patient = await prisma.opsPatient.create({
      data: {
        branchId,
        patientNumber: `P-${new Date().getFullYear()}-${String(sequence + 1).padStart(5, '0')}`,
        name,
        phone: typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null,
      },
    });
    return NextResponse.json({ patient }, { status: 201 });
  } catch (error) {
    return handleOpsError(error, 'create patient');
  }
}
