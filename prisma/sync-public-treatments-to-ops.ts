import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function operationalCode(publicTreatmentId: string): string {
  return `CAT-${publicTreatmentId}`.toUpperCase().slice(0, 30);
}

function defaultActionName(name: string): string {
  return `Pelaksanaan ${name}`.slice(0, 120);
}

async function main() {
  const publicTreatments = await prisma.treatment.findMany({
    include: { category: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });
  let created = 0;
  let updated = 0;
  let actionsCreated = 0;

  for (const publicTreatment of publicTreatments) {
    const code = operationalCode(publicTreatment.id);
    const existing = await prisma.opsTreatment.findUnique({ where: { code }, select: { id: true } });
    const treatment = await prisma.opsTreatment.upsert({
      where: { code },
      update: {
        name: publicTreatment.name,
        category: publicTreatment.category.name,
        defaultPrice: publicTreatment.price,
        active: publicTreatment.active,
      },
      create: {
        code,
        name: publicTreatment.name,
        category: publicTreatment.category.name,
        defaultPrice: publicTreatment.price,
        active: publicTreatment.active,
        actionTemplates: {
          create: {
            actionName: defaultActionName(publicTreatment.name),
            sequenceNumber: 1,
            isRequired: true,
            requiredRole: 'THERAPIST',
            estimatedDurationMinutes: publicTreatment.duration && publicTreatment.duration > 0 ? publicTreatment.duration : null,
            incentiveType: 'FIXED',
            incentiveValue: 0,
            active: true,
          },
        },
      },
    });

    const action = await prisma.opsTreatmentActionTemplate.findUnique({
      where: { treatmentId_sequenceNumber: { treatmentId: treatment.id, sequenceNumber: 1 } },
      select: { id: true },
    });
    if (!action) {
      await prisma.opsTreatmentActionTemplate.create({
        data: {
          treatmentId: treatment.id,
          actionName: defaultActionName(publicTreatment.name),
          sequenceNumber: 1,
          isRequired: true,
          requiredRole: 'THERAPIST',
          estimatedDurationMinutes: publicTreatment.duration && publicTreatment.duration > 0 ? publicTreatment.duration : null,
          incentiveType: 'FIXED',
          incentiveValue: 0,
          active: true,
        },
      });
      actionsCreated += 1;
    }

    if (existing) updated += 1;
    else created += 1;
  }

  console.log(JSON.stringify({ synced: publicTreatments.length, created, updated, actionsCreated }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
