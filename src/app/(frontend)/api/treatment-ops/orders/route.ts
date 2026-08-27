import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import { ORDER_MANAGEMENT_ROLES } from '@/lib/treatment-operations/constants';
import { handleOpsError, readJson } from '@/lib/treatment-operations/http';
import { createTreatmentOrder } from '@/lib/treatment-operations/order-service';
import { OpsError, serialize } from '@/lib/treatment-operations/utils';

export async function GET(request: Request) {
  try {
    const actor = await requireOpsStaff();
    const status = new URL(request.url).searchParams.get('status');
    const orders = await prisma.opsTreatmentOrder.findMany({
      where: {
        ...(actor.role === 'SUPER_ADMIN' ? {} : { branchId: actor.branchId || '' }),
        ...(status ? { status: status as never } : {}),
      },
      include: {
        patient: { select: { id: true, patientNumber: true, name: true } },
        doctor: { select: { id: true, name: true } },
        actions: {
          include: {
            assignedTherapist: { select: { id: true, name: true } },
            performedTherapist: { select: { id: true, name: true } },
          },
          orderBy: { sequenceNumber: 'asc' },
        },
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(serialize({ orders }));
  } catch (error) {
    return handleOpsError(error, 'list orders');
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireOpsStaff(ORDER_MANAGEMENT_ROLES);
    const body = await readJson(request);
    const required = ['branchId', 'patientId', 'treatmentId', 'visitDate'];
    if (required.some((field) => typeof body[field] !== 'string' || !body[field])) {
      throw new OpsError(400, 'Cabang, pasien, treatment, dan tanggal kunjungan wajib diisi.');
    }
    const result = await createTreatmentOrder(actor, {
      branchId: body.branchId as string,
      patientId: body.patientId as string,
      doctorId: typeof body.doctorId === 'string' ? body.doctorId : null,
      treatmentId: body.treatmentId as string,
      visitDate: new Date(`${body.visitDate as string}T00:00:00+07:00`),
      originalPrice: Number(body.originalPrice),
      discountAmount: Number(body.discountAmount || 0),
      internalNote: typeof body.internalNote === 'string' ? body.internalNote.trim() : null,
    });
    return NextResponse.json(serialize(result), { status: 201 });
  } catch (error) {
    return handleOpsError(error, 'create order');
  }
}
