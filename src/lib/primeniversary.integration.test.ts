import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';
import { campaignPhase, displayPackageStatus, packageExpiry } from './primeniversary';

let cluster: EmbeddedPostgres;
let directory: string;
let db: PrismaClient;
let publicApi: typeof import('@/app/api/primeniversary/route');
let staffApi: typeof import('@/app/api/front-office/primeniversary/route');
let authorized = true;
const runIntegrationTests = process.env.PRIMENIVERSARY_RUN_INTEGRATION_TESTS === 'true' || !process.env.CI;

describe('Primeniversary campaign rules', () => {
  it('opens and closes at midnight WIB, not UTC', () => {
    expect(campaignPhase(new Date('2026-11-10T16:59:59.999Z'))).toBe('upcoming');
    expect(campaignPhase(new Date('2026-11-10T17:00:00.000Z'))).toBe('open');
    expect(campaignPhase(new Date('2026-11-11T16:59:59.999Z'))).toBe('open');
    expect(campaignPhase(new Date('2026-11-11T17:00:00.000Z'))).toBe('closed');
  });
  it('calculates a calendar year in WIB, including leap day and midnight', () => {
    expect(packageExpiry(new Date('2026-11-11T10:30:00Z')).toISOString()).toBe('2027-11-11T10:30:00.000Z');
    expect(packageExpiry(new Date('2028-02-28T18:00:00Z')).toISOString()).toBe('2029-02-27T18:00:00.000Z');
    expect(displayPackageStatus('active', new Date('2027-11-11T10:30:00Z'), new Date('2027-11-11T10:30:00Z'))).toBe('expired');
  });
});

const integration = runIntegrationTests ? describe : describe.skip;
integration('Primeniversary registration and payment', () => {
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'drw-ipl-test-'));
    const port = await new Promise<number>((resolvePort, reject) => {
      const server = createServer();
      server.on('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (!address || typeof address === 'string') throw new Error('No test port');
        server.close(() => resolvePort(address.port));
      });
    });
    cluster = new EmbeddedPostgres({ databaseDir: join(directory, 'data'), port, user: 'postgres', password: 'isolated-test-only', authMethod: 'password', persistent: false, onLog: () => {}, onError: () => {} });
    await cluster.initialise();
    await cluster.start();
    await cluster.createDatabase('drw_ipl_test');
    const sql = await readFile(resolve('prisma/migrations/20261109000000_add_primeniversary_registrations/migration.sql'), 'utf8');
    const client = cluster.getPgClient('drw_ipl_test');
    await client.connect();
    await client.query(sql);
    await client.end();
    const url = `postgresql://postgres:isolated-test-only@127.0.0.1:${port}/drw_ipl_test`;
    db = new PrismaClient({ datasources: { db: { url } } });
    vi.doMock('@/lib/prisma', () => ({ prisma: db }));
    vi.doMock('@/lib/auth', async () => {
      const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
      return { ...actual, requireAdmin: async () => { if (!authorized) throw new actual.AuthError(401, 'Unauthorized'); return { staffId: 'test-staff' }; } };
    });
    publicApi = await import('@/app/api/primeniversary/route');
    staffApi = await import('@/app/api/front-office/primeniversary/route');
  }, 120_000);

  beforeEach(async () => {
    vi.useRealTimers();
    await db.primeniversaryRegistration.deleteMany();
    authorized = true;
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://drwprime.com');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-11T06:30:00Z'));
  });

  afterAll(async () => {
    vi.useRealTimers();
    await db?.$disconnect();
    await cluster?.stop();
    if (directory) await rm(directory, { recursive: true, force: true });
    vi.unstubAllEnvs();
    vi.doUnmock('@/lib/prisma');
    vi.doUnmock('@/lib/auth');
  }, 30_000);

  function request(url: string, body: unknown, origin = 'https://drwprime.com') {
    return new Request(`https://drwprime.com${url}`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  }
  const registration = (id = randomUUID()) => ({ requestId: id, name: 'Test Pasien', phone: '0812 3456 7890', email: 'test@example.com', consent: true, price: 1 });
  const patch = (id: string, action: string, origin = 'https://drwprime.com') => new Request('https://drwprime.com/api/front-office/primeniversary', { method: 'PATCH', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ id, action }) });

  it('rejects closed, cross-origin and unconsented submissions', async () => {
    vi.setSystemTime(new Date('2026-11-10T16:59:59Z'));
    expect((await publicApi.POST(request('/api/primeniversary', registration()))).status).toBe(403);
    vi.setSystemTime(new Date('2026-11-11T17:00:00Z'));
    expect((await publicApi.POST(request('/api/primeniversary', registration()))).status).toBe(403);
    vi.setSystemTime(new Date('2026-11-11T06:30:00Z'));
    expect((await publicApi.POST(request('/api/primeniversary', registration(), 'https://evil.example'))).status).toBe(403);
    expect((await publicApi.POST(request('/api/primeniversary', { ...registration(), consent: false }))).status).toBe(400);
    expect(await db.primeniversaryRegistration.count()).toBe(0);
  });

  it('creates only one record for concurrent retries and never accepts a client price', async () => {
    const body = registration();
    const responses = await Promise.all(Array.from({ length: 5 }, () => publicApi.POST(request('/api/primeniversary', body))));
    expect(responses.every((response) => response.ok)).toBe(true);
    const results = await Promise.all(responses.map((response) => response.json()));
    expect(new Set(results.map((result) => result.code)).size).toBe(1);
    const saved = await db.primeniversaryRegistration.findFirstOrThrow();
    expect(saved).toMatchObject({ patientPhone: '6281234567890', price: 1111000, status: 'pending', paidAt: null, expiresAt: null });
    expect(await db.primeniversaryRegistration.count()).toBe(1);
    vi.setSystemTime(new Date('2026-11-11T17:01:00Z'));
    expect((await publicApi.POST(request('/api/primeniversary', body))).status).toBe(200);
  });

  it('requires staff and atomically confirms payment only once', async () => {
    const body = registration();
    expect((await publicApi.POST(request('/api/primeniversary', body))).status).toBe(200);
    const saved = await db.primeniversaryRegistration.findFirstOrThrow();
    authorized = false;
    expect((await staffApi.GET(new Request('https://drwprime.com/api/front-office/primeniversary'))).status).toBe(401);
    expect((await staffApi.PATCH(patch(saved.id, 'confirm_payment'))).status).toBe(401);
    authorized = true;
    expect((await staffApi.PATCH(patch(saved.id, 'confirm_payment', 'https://evil.example'))).status).toBe(403);
    const results = await Promise.all(Array.from({ length: 4 }, () => staffApi.PATCH(patch(saved.id, 'confirm_payment'))));
    expect(results.filter((response) => response.status === 200)).toHaveLength(1);
    expect(results.filter((response) => response.status === 409)).toHaveLength(3);
    const paid = await db.primeniversaryRegistration.findUniqueOrThrow({ where: { id: saved.id } });
    expect(paid).toMatchObject({ status: 'active', confirmedBy: 'test-staff', paidAt: new Date('2026-11-11T06:30:00Z'), expiresAt: new Date('2027-11-11T06:30:00Z') });
    vi.setSystemTime(new Date('2026-12-01T06:30:00Z'));
    expect((await staffApi.PATCH(patch(saved.id, 'confirm_payment'))).status).toBe(409);
    expect((await db.primeniversaryRegistration.findUniqueOrThrow({ where: { id: saved.id } })).expiresAt).toEqual(paid.expiresAt);
    const listing = await (await staffApi.GET(new Request('https://drwprime.com/api/front-office/primeniversary?search=0812'))).json();
    expect(listing.summary).toMatchObject({ total: 1, pending: 0, active: 1, paidCount: 1, paidAmount: 1111000 });
    expect(listing.registrations).toHaveLength(1);
  });

  it('prevents an unpaid cancelled registration from being activated', async () => {
    await publicApi.POST(request('/api/primeniversary', registration()));
    const saved = await db.primeniversaryRegistration.findFirstOrThrow();
    expect((await staffApi.PATCH(patch(saved.id, 'cancel'))).status).toBe(200);
    expect((await staffApi.PATCH(patch(saved.id, 'confirm_payment'))).status).toBe(409);
    expect(await db.primeniversaryRegistration.findUniqueOrThrow({ where: { id: saved.id } })).toMatchObject({ status: 'cancelled', paidAt: null, expiresAt: null });
  });
});
