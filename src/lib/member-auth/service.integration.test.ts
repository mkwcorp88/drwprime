import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';

// Real PostgreSQL, isolated cluster and database. Never adopt DATABASE_URL from
// a developer's .env or use a production database. Only the WhatsApp transport is mocked.
let cluster: EmbeddedPostgres;
let directory: string;
let db: PrismaClient;
let service: typeof import('./service');
let sessions: typeof import('./session');
const deliveries = new Map<string, string>();
const send = vi.fn(async (phone: string, code: string) => { deliveries.set(phone, code); });
const browser = () => randomBytes(32).toString('base64url');

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'drw-member-auth-test-'));
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
  await cluster.createDatabase('drw_member_auth_test');
  const url = `postgresql://postgres:isolated-test-only@127.0.0.1:${port}/drw_member_auth_test`;
  const pushed = spawnSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'db', 'push', '--skip-generate'], { env: { ...process.env, DATABASE_URL: url }, encoding: 'utf8' });
  if (pushed.status !== 0) throw new Error(`Could not prepare isolated test schema: ${pushed.stderr}`);
  db = new PrismaClient({ datasources: { db: { url } } });
  vi.doMock('@/lib/prisma', () => ({ prisma: db }));
  vi.doMock('./whatsapp', () => ({ requireMemberOtpConfig: () => ({}), sendMemberOtp: send }));
  vi.doMock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: null }), currentUser: async () => null }));
  service = await import('./service');
  sessions = await import('./session');
}, 120_000);

beforeEach(async () => {
  vi.stubEnv('MEMBER_OTP_SECRET', 'test-only-secret-thirty-two-characters-minimum');
  deliveries.clear(); send.mockClear();
  await db.$executeRaw`TRUNCATE TABLE users CASCADE`;
  await db.memberLoginOtp.deleteMany();
  await db.preClaimAffiliateCode.deleteMany();
});

afterAll(async () => {
  await db?.$disconnect();
  await cluster?.stop();
  if (directory) await rm(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
}, 30_000);

async function request(phone = '6281234567890', binding = browser(), ip = '127.0.0.1') {
  const challenge = await service.requestMemberOtp(phone, binding, ip);
  return { ...challenge, binding, code: deliveries.get(phone)! };
}

async function registered(phone = '6281234567890', data = {}) {
  return db.user.create({ data: { firstName: 'Member', phone, loginPhone: phone, loginPhoneVerifiedAt: new Date(), hasAccount: true, ...data } });
}

describe('member OTP transaction boundaries', () => {
  it('does not issue a session before proof and registers using only the verified phone', async () => {
    const otp = await request();
    expect(otp).not.toHaveProperty('sessionToken');
    const row = await db.memberLoginOtp.findUniqueOrThrow({ where: { id: otp.challengeId } });
    expect(row.codeHash).not.toBe(otp.code);
    await expect(service.enrollMember(browser(), otp.binding, { firstName: 'Other' })).rejects.toMatchObject({ code: 'ENROLLMENT_INVALID' });
    const proof = await service.verifyMemberOtp(otp.challengeId, otp.code, otp.binding);
    if (proof.kind !== 'enroll') throw new Error('Expected enrollment');
    expect(await db.memberSession.count()).toBe(0);
    const token = await service.enrollMember(proof.grantToken, otp.binding, { firstName: 'New Member', phone: '6289999999999', email: 'wahyu.putri@drwcorp.com', isAdmin: true });
    const user = await sessions.resolveMemberToken(token);
    expect(user).toMatchObject({ phone: otp.phone, loginPhone: otp.phone, firstName: 'New Member', isAdmin: false, hasAccount: true });
    expect(user?.qrToken).toBeTruthy();
    await expect(service.enrollMember(proof.grantToken, otp.binding, { firstName: 'Replay' })).rejects.toMatchObject({ code: 'ENROLLMENT_INVALID' });
  });

  it('binds proof and registration grants to the requesting browser', async () => {
    const otp = await request();
    await expect(service.verifyMemberOtp(otp.challengeId, otp.code, browser())).rejects.toMatchObject({ code: 'OTP_INVALID' });
    const proof = await service.verifyMemberOtp(otp.challengeId, otp.code, otp.binding);
    if (proof.kind !== 'enroll') throw new Error('Expected enrollment');
    await expect(service.enrollMember(proof.grantToken, browser(), { firstName: 'Attacker' })).rejects.toMatchObject({ code: 'ENROLLMENT_INVALID' });
  });

  it('serializes simultaneous successful verification so only one session is created', async () => {
    await registered();
    const otp = await request();
    const results = await Promise.allSettled(Array.from({ length: 4 }, () => service.verifyMemberOtp(otp.challengeId, otp.code, otp.binding)));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await db.memberSession.count()).toBe(1);
  });

  it('counts concurrent wrong attempts without rolling back the counter', async () => {
    await registered();
    const otp = await request();
    const wrong = otp.code === '000000' ? '111111' : '000000';
    await Promise.allSettled(Array.from({ length: 8 }, () => service.verifyMemberOtp(otp.challengeId, wrong, otp.binding)));
    expect((await db.memberLoginOtp.findUniqueOrThrow({ where: { id: otp.challengeId } })).attempts).toBe(5);
    await expect(service.verifyMemberOtp(otp.challengeId, otp.code, otp.binding)).rejects.toMatchObject({ code: 'OTP_INVALID' });
    expect(await db.memberSession.count()).toBe(0);
  });

  it('rejects expired codes and expired registration grants', async () => {
    const otp = await request();
    await db.memberLoginOtp.update({ where: { id: otp.challengeId }, data: { expiresAt: new Date(Date.now() - 1) } });
    await expect(service.verifyMemberOtp(otp.challengeId, otp.code, otp.binding)).rejects.toMatchObject({ code: 'OTP_INVALID' });
    const next = await request('6281234567891');
    const proof = await service.verifyMemberOtp(next.challengeId, next.code, next.binding);
    if (proof.kind !== 'enroll') throw new Error('Expected enrollment');
    await db.memberLoginOtp.update({ where: { id: next.challengeId }, data: { grantExpiresAt: new Date(Date.now() - 1) } });
    await expect(service.enrollMember(proof.grantToken, next.binding, { firstName: 'Late' })).rejects.toMatchObject({ code: 'ENROLLMENT_INVALID' });
  });

  it('allows only one concurrent send per number during the cooldown', async () => {
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => service.requestMemberOtp('081234567890', browser(), '127.0.0.1')));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(send).toHaveBeenCalledOnce();
    expect(await db.memberLoginOtp.count()).toBe(1);
  });

  it('retains failed deliveries for rate accounting and never verifies them', async () => {
    send.mockRejectedValueOnce(new Error('transport failed'));
    await expect(request()).rejects.toThrow('transport failed');
    const row = await db.memberLoginOtp.findFirstOrThrow();
    expect(row.deliveredAt).toBeNull();
    expect(row.consumedAt).not.toBeNull();
    await expect(request()).rejects.toMatchObject({ status: 429 });
  });

  it('invalidates the earlier code on resend and enforces the phone window limit', async () => {
    await registered();
    const first = await request();
    let last = first;
    for (let i = 1; i < 5; i++) {
      await db.memberLoginOtp.update({ where: { id: last.challengeId }, data: { createdAt: new Date(Date.now() - 61_000) } });
      last = await request();
    }
    await expect(service.verifyMemberOtp(first.challengeId, first.code, first.binding)).rejects.toMatchObject({ code: 'OTP_INVALID' });
    await expect(request()).rejects.toMatchObject({ code: 'OTP_RATE_LIMITED' });
  });

  it('limits one IP across different phone numbers', async () => {
    for (let i = 0; i < 20; i++) await request(`62812555${String(i).padStart(5, '0')}`);
    await expect(request('6281255599999')).rejects.toMatchObject({ code: 'OTP_RATE_LIMITED' });
  });
});

describe('legacy account continuity and recovery', () => {
  it('preserves user ID, Clerk link, points, commissions, QR and spending history after activation', async () => {
    const old = await db.user.create({ data: { firstName: 'Existing', phone: '0812-3456-7890', clerkUserId: 'legacy-clerk', dateOfBirth: new Date('1990-01-02'), nik: '1234567890123456', points: 45, totalEarnings: 123000, qrToken: 'existing-qr', affiliateCode: 'EXIST1' } });
    await db.spendingRecord.create({ data: { userId: old.id, amount: 450000, pointsEarned: 45, spendingDate: new Date() } });
    const otp = await request();
    const proof = await service.verifyMemberOtp(otp.challengeId, otp.code, otp.binding);
    if (proof.kind !== 'enroll') throw new Error('Expected activation');
    expect(proof.stage).toBe('activate');
    await expect(service.enrollMember(proof.grantToken, otp.binding, { dateOfBirth: '1991-01-02' })).rejects.toMatchObject({ code: 'ENROLLMENT_INVALID' });
    const token = await service.enrollMember(proof.grantToken, otp.binding, { dateOfBirth: '1990-01-02' });
    const activated = await sessions.resolveMemberToken(token);
    expect(activated).toMatchObject({ id: old.id, clerkUserId: old.clerkUserId, nik: old.nik, points: 45, qrToken: 'existing-qr', affiliateCode: 'EXIST1' });
    expect(Number(activated?.totalEarnings)).toBe(123000);
    expect(await db.spendingRecord.count({ where: { userId: old.id } })).toBe(1);
    expect(await db.user.count()).toBe(1);
  });

  it('requires FO assistance for ambiguous or unverifiable legacy records', async () => {
    await db.user.create({ data: { firstName: 'One', phone: '081234567890', dateOfBirth: new Date('1990-01-02') } });
    await db.user.create({ data: { firstName: 'Two', phone: '+6281234567890', dateOfBirth: new Date('1990-01-02') } });
    const otp = await request();
    expect(await service.verifyMemberOtp(otp.challengeId, otp.code, otp.binding)).toEqual({ kind: 'support' });
    expect(await db.memberSession.count()).toBe(0);
  });

  it('does not turn a changed contact number into a login credential', async () => {
    const old = await registered();
    await db.user.update({ where: { id: old.id }, data: { phone: '6281234567891' } });
    const otp = await request('6281234567891');
    expect(await service.verifyMemberOtp(otp.challengeId, otp.code, otp.binding)).toEqual({ kind: 'support' });
  });

  it('requires OTP after FO approval, revokes old sessions and uses the same user record', async () => {
    const old = await registered();
    const first = await request();
    const loggedIn = await service.verifyMemberOtp(first.challengeId, first.code, first.binding);
    if (loggedIn.kind !== 'session') throw new Error('Expected session');
    await service.approveMemberPhoneRecovery(old.id, '081234567891', 'Identitas dan nomor baru dicocokkan di klinik.', 'staff-clerk');
    expect(await sessions.resolveMemberToken(loggedIn.sessionToken)).toBeNull();
    expect((await db.user.findUniqueOrThrow({ where: { id: old.id } })).loginPhone).toBe(old.loginPhone);
    const otp = await request('6281234567891');
    const proof = await service.verifyMemberOtp(otp.challengeId, otp.code, otp.binding);
    if (proof.kind !== 'session') throw new Error('Expected recovered session');
    expect(await sessions.resolveMemberToken(proof.sessionToken)).toMatchObject({ id: old.id, loginPhone: otp.phone });
    expect((await db.memberPhoneRecovery.findFirstOrThrow()).consumedAt).not.toBeNull();
    expect(await db.user.count()).toBe(1);
  });

  it('rejects recovery to another member number', async () => {
    const old = await registered();
    await registered('6281234567891');
    await expect(service.approveMemberPhoneRecovery(old.id, '081234567891', 'Identitas diperiksa di klinik.', 'staff-clerk')).rejects.toMatchObject({ code: 'PHONE_CONFLICT' });
  });

  it('does not let a WhatsApp member session satisfy the Clerk admin guard', async () => {
    const { requireAdmin } = await import('@/lib/auth');
    await registered('6281234567890', { isAdmin: true });
    const otp = await request();
    expect((await service.verifyMemberOtp(otp.challengeId, otp.code, otp.binding)).kind).toBe('session');
    await expect(requireAdmin()).rejects.toMatchObject({ status: 401 });
  });

  it('applies the additive migration without altering legacy member data', async () => {
    await cluster.createDatabase('member_migration_test');
    const client = cluster.getPgClient('member_migration_test');
    await client.connect();
    try {
      await client.query('CREATE TABLE users (id TEXT PRIMARY KEY, clerk_user_id TEXT, phone TEXT, points INTEGER)');
      await client.query("INSERT INTO users VALUES ('existing', 'legacy', '081234567890', 42)");
      const migration = await readFile(resolve('prisma/migrations/20260911100000_add_member_whatsapp_auth/migration.sql'), 'utf8');
      await client.query(migration);
      const result = await client.query('SELECT id, clerk_user_id, points, login_phone FROM users');
      expect(result.rows).toEqual([{ id: 'existing', clerk_user_id: 'legacy', points: 42, login_phone: null }]);

      await client.query("INSERT INTO member_sessions (id, user_id, token_hash, expires_at) VALUES ('active', 'existing', 'legacy-session', NOW())");
      const cutover = await readFile(resolve('prisma/migrations/20260916120000_force_member_otp_relogin/migration.sql'), 'utf8');
      await client.query(cutover);
      expect((await client.query('SELECT COUNT(*)::int AS count FROM member_sessions')).rows[0].count).toBe(0);
    } finally { await client.end(); }
  });
});
