import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { findAidoPatient, searchAidoPatients } from '@/lib/aido/patient-directory';
import { AidoConfigurationError, AidoRequestError } from '@/lib/aido/client';
import { requireOpsStaff } from '@/lib/treatment-operations/auth';
import {
  MANUAL_PATIENT_ENTRY_ROLES,
  ORDER_MANAGEMENT_ROLES,
} from '@/lib/treatment-operations/constants';
import { handleOpsError, readJson } from '@/lib/treatment-operations/http';
import { parseManualPatientInput } from '@/lib/treatment-operations/patients';
import { OpsError } from '@/lib/treatment-operations/utils';

function aidoError(error: unknown): NextResponse | null {
  if (error instanceof AidoConfigurationError) {
    return NextResponse.json({ error: 'Koneksi AIDO belum dikonfigurasi.' }, { status: 503 });
  }
  if (error instanceof AidoRequestError) {
    return NextResponse.json({ error: 'Data pasien AIDO sedang tidak tersedia.' }, { status: 502 });
  }
  return null;
}

export async function GET(request: Request) {
  try {
    await requireOpsStaff(ORDER_MANAGEMENT_ROLES);
    const query = new URL(request.url).searchParams.get('q')?.trim() || '';
    if (query.length < 2) return NextResponse.json({ source: 'AIDO', patients: [] });

    const patients = await searchAidoPatients(query);
    return NextResponse.json({
      source: 'AIDO',
      patients: patients.map((patient) => ({
        externalPatientId: patient.externalPatientId,
        externalPatientNumericId: patient.externalPatientNumericId,
        name: [patient.firstName, patient.lastName].filter(Boolean).join(' '),
        phone: patient.phone,
        mrNumber: patient.mrNumber,
      })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const response = aidoError(error);
    return response || handleOpsError(error, 'search AIDO patients');
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireOpsStaff(ORDER_MANAGEMENT_ROLES);
    const body = await readJson(request);
    const branchId = typeof body.branchId === 'string' ? body.branchId.trim() : actor.branchId;
    const aidoPatientId = typeof body.aidoPatientId === 'string' ? body.aidoPatientId.trim() : '';
    if (!branchId) throw new OpsError(400, 'Cabang wajib diisi.');
    if (actor.role !== 'SUPER_ADMIN' && actor.branchId !== branchId) throw new OpsError(403, 'Cabang tidak diizinkan.');

    if (body.source === 'MANUAL') {
      if (!MANUAL_PATIENT_ENTRY_ROLES.includes(actor.role)) {
        throw new OpsError(403, 'Role ini tidak dapat menambah pasien manual.');
      }

      const manualInput = parseManualPatientInput(body);

      const patientNumber = `MANUAL-${randomBytes(9).toString('hex').toUpperCase()}`;
      const patient = await prisma.$transaction(async (tx) => {
        const created = await tx.opsPatient.create({
          data: {
            branchId,
            patientNumber,
            name: manualInput.name,
            phone: manualInput.phone,
            source: 'MANUAL',
            manualEntryReason: manualInput.manualEntryReason,
            manualEntryNote: manualInput.manualEntryNote,
          },
        });
        await tx.opsAuditLog.create({
          data: {
            actorUserId: actor.id,
            branchId,
            entityType: 'OPS_PATIENT',
            entityId: created.id,
            action: 'CREATE_MANUAL_FALLBACK',
            reason: manualInput.manualEntryReason,
            afterData: { source: 'MANUAL', patientNumber },
          },
        });
        return created;
      });
      return NextResponse.json({ patient }, { status: 201 });
    }

    if (!aidoPatientId) throw new OpsError(400, 'Pilih pasien dari hasil pencarian AIDO.');
    const { session, patient: aidoPatient } = await findAidoPatient(aidoPatientId);
    if (!aidoPatient) throw new OpsError(404, 'Pasien AIDO tidak ditemukan. Silakan cari ulang.');

    const name = [aidoPatient.firstName, aidoPatient.lastName].filter(Boolean).join(' ').trim();
    const patientNumber = aidoPatientNumber(branchId, session.hospitalId, aidoPatient.externalPatientId);
    const patient = await prisma.opsPatient.upsert({
      where: { patientNumber },
      create: {
        branchId,
        patientNumber,
        name,
        phone: aidoPatient.phone,
        aidoHospitalId: session.hospitalId,
        aidoExternalPatientId: aidoPatient.externalPatientId,
        aidoExternalNumericId: aidoPatient.externalPatientNumericId,
        mrNumber: aidoPatient.mrNumber,
        source: 'AIDO',
        manualEntryReason: null,
        manualEntryNote: null,
      },
      update: {
        name,
        phone: aidoPatient.phone,
        aidoHospitalId: session.hospitalId,
        aidoExternalPatientId: aidoPatient.externalPatientId,
        aidoExternalNumericId: aidoPatient.externalPatientNumericId,
        mrNumber: aidoPatient.mrNumber,
        source: 'AIDO',
        manualEntryReason: null,
        manualEntryNote: null,
      },
    });
    return NextResponse.json({ patient }, { status: 201 });
  } catch (error) {
    const response = aidoError(error);
    return response || handleOpsError(error, 'create patient');
  }
}

function aidoPatientNumber(branchId: string, hospitalId: string, externalPatientId: string): string {
  const digest = createHash('sha256')
    .update(`${branchId}:${hospitalId}:${externalPatientId}`)
    .digest('hex')
    .slice(0, 14)
    .toUpperCase();
  return `AIDO-${digest}`;
}
