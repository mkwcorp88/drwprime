import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';

let cluster: EmbeddedPostgres;
let directory: string;
let db: PrismaClient;
let route: typeof import('@/app/(frontend)/api/front-office/affiliators/route');
let authorized = true;
const runIntegrationTests = process.env.AFFILIATOR_RUN_INTEGRATION_TESTS === 'true' || !process.env.CI;
const integration = runIntegrationTests ? describe : describe.skip;

integration('GET /api/front-office/affiliators integration', () => {
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'drw-affiliator-test-'));
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
    await cluster.createDatabase('drw_affiliator_test');

    const url = `postgresql://postgres:isolated-test-only@127.0.0.1:${port}/drw_affiliator_test`;
    const pushed = spawnSync(
      process.execPath,
      [resolve('node_modules/prisma/build/index.js'), 'db', 'push', '--skip-generate'],
      { env: { ...process.env, DATABASE_URL: url }, encoding: 'utf8' }
    );
    if (pushed.status !== 0) {
      throw new Error(`Could not prepare isolated test schema: ${pushed.stderr}`);
    }

    db = new PrismaClient({ datasources: { db: { url } } });
    vi.doMock('@/lib/prisma', () => ({ prisma: db }));
    vi.doMock('@/lib/auth', async () => {
      const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
      return {
        ...actual,
        requireAdmin: async () => {
          if (!authorized) throw new actual.AuthError(401, 'Unauthorized');
          return {
            staffId: 'test-staff',
            clerkUserId: 'staff:test',
            isAdmin: true,
            cmsAccess: true,
            primaryEmail: 'staff@drwprime.test',
            firstName: 'Staff',
            lastName: 'Test',
            primaryPhone: null,
            verifiedPhones: [],
          };
        },
      };
    });

    route = await import('@/app/(frontend)/api/front-office/affiliators/route');
  }, 120_000);

  beforeEach(async () => {
    authorized = true;
    await db.$executeRaw`TRUNCATE TABLE users CASCADE`;
    await db.productOrder.deleteMany();
    await db.crmLead.deleteMany();
    await db.preClaimAffiliateCode.deleteMany();
    await db.treatmentCategory.deleteMany();
    await db.opsBranch.deleteMany();
  });

  afterAll(async () => {
    await db?.$disconnect();
    await cluster?.stop();
    if (directory) await rm(directory, { recursive: true, force: true });
  }, 30_000);

  it('rejects unauthenticated requests with 401', async () => {
    authorized = false;
    const response = await route.GET();
    expect(response.status).toBe(401);
  });

  it('crawls affiliator phone numbers from profile, orders, bank account name, CRM lead, and member records', async () => {
    await db.user.create({
      data: {
        firstName: 'Verified',
        lastName: 'Affiliator',
        email: 'verified@gmail.com',
        loginPhone: '6281111111111',
        affiliateCode: 'VERIF1',
        hasAccount: true,
      },
    });

    const bankMatchedAff = await db.user.create({
      data: {
        firstName: 'Glow',
        lastName: 'Queen',
        email: 'glowqueen@gmail.com',
        affiliateCode: 'GLOW1',
        totalEarnings: 150000,
        hasAccount: true,
      },
    });
    await db.bankAccount.create({
      data: {
        userId: bankMatchedAff.id,
        accountType: 'bank',
        bankName: 'BCA',
        accountNumber: '1234567890',
        accountName: 'Nisa Rahmawati',
        isDefault: true,
      },
    });
    await db.user.create({
      data: {
        firstName: 'Ny. Nisa Rahmawati',
        lastName: null,
        phone: '6287712345678',
        nomorRekamMedis: 'RM-8899',
        hasAccount: false,
      },
    });

    await db.user.create({
      data: {
        firstName: 'Order',
        lastName: 'Buyer',
        email: 'Order.Buyer@gmail.com',
        affiliateCode: 'ORDR1',
        hasAccount: true,
      },
    });
    await db.productOrder.create({
      data: {
        invoiceNumber: 'INV-TEST-1',
        publicToken: 'tok-test-1',
        customerName: 'Order Buyer',
        customerEmail: 'order.buyer@gmail.com',
        customerPhone: '081234567890',
        totalAmount: 250000,
        listSubtotal: 250000,
      },
    });

    await db.user.create({
      data: {
        firstName: 'Rina',
        lastName: 'Wahyuni',
        email: 'rina@gmail.com',
        affiliateCode: 'RINA1',
        hasAccount: true,
      },
    });
    await db.user.create({
      data: {
        firstName: 'Rina Wahyuni',
        lastName: null,
        phone: '6285611223344',
        nomorRekamMedis: 'RM-4455',
        hasAccount: false,
      },
    });

    await db.user.create({
      data: {
        firstName: 'Maya',
        lastName: 'Pratiwi',
        email: 'maya.p@gmail.com',
        affiliateCode: 'MAYA1',
        hasAccount: true,
      },
    });
    await db.crmLead.create({
      data: {
        name: 'Maya Pratiwi',
        phone: '081355667788',
        phoneNormalized: '6281355667788',
        source: 'ADS',
        createdBy: 'staff:test',
        updatedBy: 'staff:test',
      },
    });

    const response = await route.GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.total).toBe(5);
    expect(body.summary).toEqual({
      total: 5,
      withPhoneCount: 5,
      verifiedCount: 1,
      exactCount: 1,
      highCount: 3,
      candidateCount: 0,
      missingCount: 0,
    });

    const byCode = new Map<string, (typeof body.affiliators)[number]>(
      body.affiliators.map((a: { affiliateCode: string }) => [a.affiliateCode, a])
    );

    expect(byCode.get('VERIF1')).toMatchObject({
      phone: '6281111111111',
      phoneConfidence: 'verified',
      phoneSource: 'login_phone',
    });
    expect(byCode.get('GLOW1')).toMatchObject({
      phone: '6287712345678',
      phoneConfidence: 'high',
      phoneSource: 'bank_account_name_exact',
      matchedMrNumber: 'RM-8899',
      remainingCommission: 150000,
    });
    expect(byCode.get('ORDR1')).toMatchObject({
      phone: '6281234567890',
      phoneConfidence: 'exact',
      phoneSource: 'product_order_email',
    });
    expect(byCode.get('RINA1')).toMatchObject({
      phone: '6285611223344',
      phoneConfidence: 'high',
      phoneSource: 'member_name_exact',
      matchedMrNumber: 'RM-4455',
    });
    expect(byCode.get('MAYA1')).toMatchObject({
      phone: '6281355667788',
      phoneConfidence: 'high',
      phoneSource: 'crm_lead_name_exact',
    });
  });
});
