import { PrismaClient } from '@prisma/client';
import { TREATMENT_PROTOCOLS } from './protocol-master';

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.opsStaff.findFirst({ where: { role: 'SUPER_ADMIN' }, select: { id: true } });
  const created: string[] = [];
  const updated: string[] = [];

  for (const protocol of TREATMENT_PROTOCOLS) {
    const existing = await prisma.opsTreatmentProtocol.findUnique({ where: { code: protocol.code } });
    await prisma.$transaction(async (tx) => {
      const protocolId = existing
        ? existing.id
        : (await tx.opsTreatmentProtocol.create({
            data: {
              code: protocol.code,
              name: protocol.name,
              version: 1,
              approvalStatus: 'DRAFT',
            },
          })).id;

      await tx.opsTreatmentProtocolStep.deleteMany({ where: { protocolId } });
      await tx.opsTreatmentProtocolStep.createMany({
        data: protocol.steps.map((step) => ({
          protocolId,
          stepCode: step.stepCode,
          sequence: step.sequence,
          name: step.name,
          defaultRole: step.defaultRole,
          isRequired: step.isRequired,
        })),
      });

      if (admin) {
        await tx.opsAuditLog.create({
          data: {
            actorUserId: admin.id,
            entityType: 'TREATMENT_PROTOCOL',
            entityId: protocolId,
            action: existing ? 'IMPORT_UPDATE' : 'IMPORT_CREATE',
            reason: 'Impor master protokol dari dokumen Master Treatment',
            afterData: { code: protocol.code, name: protocol.name, steps: protocol.steps.length },
          },
        });
      }
    });

    if (existing) updated.push(protocol.code);
    else created.push(protocol.code);
  }

  console.log(`Protokol dibuat: ${created.length} | Diperbarui: ${updated.length}`);
  for (const code of created) console.log(`  + ${code}`);
  for (const code of updated) console.log(`  ~ ${code}`);
  console.log('Semua protokol berstatus DRAFT dan belum digunakan untuk eksekusi order.');
}

main()
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(() => prisma.$disconnect());
