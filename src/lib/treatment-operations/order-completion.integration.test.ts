import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';

let cluster: EmbeddedPostgres;
let directory: string;
let db: PrismaClient;
let completion: typeof import('./order-completion');
let sequence = 0;
const runIntegrationTests = process.env.TREATMENT_COMPLETION_RUN_INTEGRATION_TESTS === 'true' || !process.env.CI;
const integrationDescribe = runIntegrationTests ? describe : describe.skip;

beforeAll(async () => {
  if (!runIntegrationTests) return;
  directory = await mkdtemp(join(tmpdir(), 'drw-treatment-completion-test-'));
  const port = await new Promise<number>((resolvePort, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('No test port');
      server.close(() => resolvePort(address.port));
    });
  });
  cluster = new EmbeddedPostgres({
    databaseDir: join(directory, 'data'),
    port,
    user: 'postgres',
    password: 'isolated-test-only',
    authMethod: 'password',
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });
  await cluster.initialise();
  await cluster.start();
  await cluster.createDatabase('drw_treatment_completion_test');
  const url = `postgresql://postgres:isolated-test-only@127.0.0.1:${port}/drw_treatment_completion_test`;
  const pushed = spawnSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'db', 'push', '--skip-generate'], {
    env: { ...process.env, DATABASE_URL: url },
    encoding: 'utf8',
  });
  if (pushed.status !== 0) throw new Error(`Could not prepare isolated test schema: ${pushed.stderr}`);
  db = new PrismaClient({ datasources: { db: { url } } });
  vi.doMock('@/lib/prisma', () => ({ prisma: db }));
  completion = await import('./order-completion');
}, 120_000);

beforeEach(async () => {
  sequence = 0;
  await db.$executeRaw`TRUNCATE TABLE "users", "ops_branches" CASCADE`;
});

afterAll(async () => {
  await db?.$disconnect();
  await cluster?.stop();
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function completedOrder(input: { phone: string | null; mrNumber?: string | null; amount: number }) {
  const branch = await db.opsBranch.create({ data: { code: `JKT-${++sequence}`, name: 'Jakarta' } });
  const actor = await db.opsStaff.create({
    data: {
      branchId: branch.id,
      username: `operator-${sequence}`,
      passwordHash: 'test-only',
      employeeId: `EMP-${sequence}`,
      name: 'Operator',
      role: 'SUPER_ADMIN',
    },
  });
  const patient = await db.opsPatient.create({
    data: {
      branchId: branch.id,
      patientNumber: `PAT-${sequence}`,
      name: 'Prime Society',
      phone: input.phone,
      mrNumber: input.mrNumber ?? null,
    },
  });
  const treatment = await db.opsTreatment.create({
    data: { code: `TRT-${sequence}`, name: 'Facial Glow', defaultPrice: input.amount },
  });
  return db.opsTreatmentOrder.create({
    data: {
      orderNumber: `TRX-TEST-${sequence}`,
      branchId: branch.id,
      patientId: patient.id,
      treatmentId: treatment.id,
      visitDate: new Date('2026-09-17T00:00:00.000Z'),
      originalPrice: input.amount,
      discountAmount: 0,
      finalPrice: input.amount,
      status: 'COMPLETED',
      patientNameSnapshot: 'Prime Society',
      treatmentNameSnapshot: 'Facial Glow',
      qrTokenHash: randomUUID(),
      createdById: actor.id,
      completedAt: new Date('2026-09-17T05:00:00.000Z'),
    },
  });
}

integrationDescribe('treatment completion points', () => {
  it('matches a registered member through normalized loginPhone and remains idempotent', async () => {
    const member = await db.user.create({
      data: {
        firstName: 'Registered',
        phone: '0812-3456-7890',
        loginPhone: '6281234567890',
        loginPhoneVerifiedAt: new Date(),
        hasAccount: true,
        points: 20,
        totalSpending: 200_000,
      },
    });
    const order = await completedOrder({ phone: '+62 812 3456 7890', amount: 125_000 });

    const result = await completion.handleOrderCompletionPointsAndNotification(order.id);

    expect(result).toMatchObject({
      notificationPhone: '6281234567890',
      pointsEarned: 12,
      newTier: 'Bronze',
      user: { id: member.id, hasAccount: true, points: 32 },
    });
    expect(await db.spendingRecord.count({ where: { source: 'treatment_ops', externalId: order.id } })).toBe(1);
    expect(await db.transaction.count({ where: { userId: member.id, referenceId: order.id } })).toBe(1);
    expect(await completion.handleOrderCompletionPointsAndNotification(order.id)).toBeNull();
    expect(await db.spendingRecord.count({ where: { source: 'treatment_ops', externalId: order.id } })).toBe(1);
  });

  it('creates a walk-in member from a normalized patient number', async () => {
    const order = await completedOrder({ phone: '0812/3456 7890', amount: 1_500_000 });

    const result = await completion.handleOrderCompletionPointsAndNotification(order.id);

    expect(result).toMatchObject({
      notificationPhone: '6281234567890',
      pointsEarned: 150,
      newTier: 'Silver',
      user: { phone: '6281234567890', hasAccount: false, points: 150 },
    });
    expect(await db.user.count({ where: { phone: '6281234567890', hasAccount: false } })).toBe(1);
  });

  it('awards points through an MR-number match when the patient phone is absent', async () => {
    const member = await db.user.create({
      data: {
        firstName: 'MR Member',
        nomorRekamMedis: 'RM-100',
        loginPhone: '6287777777777',
        loginPhoneVerifiedAt: new Date(),
        hasAccount: true,
      },
    });
    const order = await completedOrder({ phone: null, mrNumber: 'RM-100', amount: 100_000 });

    const result = await completion.handleOrderCompletionPointsAndNotification(order.id);

    expect(result).toMatchObject({
      notificationPhone: '6287777777777',
      pointsEarned: 10,
      user: { id: member.id, hasAccount: true, points: 10 },
    });
  });
});
