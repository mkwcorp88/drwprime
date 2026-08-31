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
    const required = ['branchId', 'patientId', 'visitDate', 'visitTime'];
    if (required.some((field) => typeof body[field] !== 'string' || !body[field])) {
      throw new OpsError(400, 'Cabang, pasien, tanggal, dan jam kunjungan wajib diisi.');
    }
    const treatments = Array.isArray(body.treatments)
      ? body.treatments
      : [{ treatmentId: body.treatmentId, originalPrice: body.originalPrice, discountAmount: body.discountAmount }];
    if (!treatments.length || treatments.some((item) => !item || typeof item.treatmentId !== 'string' || !item.treatmentId)) {
      throw new OpsError(400, 'Minimal satu treatment wajib dipilih.');
    }
    const shared = {
      branchId: body.branchId as string,
      patientId: body.patientId as string,
      doctorId: typeof body.doctorId === 'string' ? body.doctorId : null,
      visitDate: new Date(`${body.visitDate as string}T00:00:00+07:00`),
      scheduledAt: new Date(`${body.visitDate as string}T${body.visitTime as string}:00+07:00`),
      internalNote: typeof body.internalNote === 'string' ? body.internalNote.trim() : null,
    };
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.visitTime as string) || Number.isNaN(shared.scheduledAt.getTime())) {
      throw new OpsError(422, 'Jam kunjungan tidak valid.');
    }
    const results = await Promise.all(treatments.map((item) => createTreatmentOrder(actor, {
      ...shared,
      treatmentId: item.treatmentId,
      originalPrice: Number(item.originalPrice),
      discountAmount: Number(item.discountAmount || 0),
    })));
    return NextResponse.json(serialize({ results }), { status: 201 });
  } catch (error) {
    return handleOpsError(error, 'create order');
  }
}
