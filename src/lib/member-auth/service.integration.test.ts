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
let google: typeof import('./google');
const deliveries = new Map<string, string>();
const send = vi.fn(async (phone: string, code: string) => { deliveries.set(phone, code); });
const browser = () => randomBytes(32).toString('base64url');
const runIntegrationTests = process.env.MEMBER_AUTH_RUN_INTEGRATION_TESTS === 'true' || !process.env.CI;
const integrationDescribe = runIntegrationTests ? describe : describe.skip;

beforeAll(async () => {
  if (!runIntegrationTests) return;
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
  google = await import('./google');
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

const googleIdentity = (sub = 'google-sub') => ({ sub, email: 'google@example.com', firstName: 'Google', lastName: 'Member' });

async function profileOtp(memberId: string, phone = '6281234567890', binding = browser()) {
  const challenge = await service.requestMemberOtp(phone, binding, '127.0.0.1', memberId);
  return { ...challenge, binding, code: deliveries.get(phone)! };
}

integrationDescribe('member OTP transaction boundaries', () => {
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

integrationDescribe('legacy account continuity and recovery', () => {
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

  it('uses date of birth to resolve ambiguous legacy records', async () => {
    const one = await db.user.create({ data: { firstName: 'One', phone: '081234567890', dateOfBirth: new Date('1990-01-02') } });
    const two = await db.user.create({ data: { firstName: 'Two', phone: '+6281234567890', dateOfBirth: new Date('1991-01-02') } });
    const otp = await request();
    const proof = await service.verifyMemberOtp(otp.challengeId, otp.code, otp.binding);
    expect(proof).toMatchObject({ kind: 'enroll', stage: 'activate' });
    if (proof.kind !== 'enroll') throw new Error('Expected activation');
    const token = await service.enrollMember(proof.grantToken, otp.binding, { dateOfBirth: '1991-01-02' });
    const activated = await sessions.resolveMemberToken(token);
    expect(activated).toMatchObject({ id: two.id });
    expect(activated).not.toMatchObject({ id: one.id });
    expect(await db.memberSession.count()).toBe(1);
  });

  it('keeps Front Office fallback when ambiguous legacy records share date of birth', async () => {
    await db.user.create({ data: { firstName: 'One', phone: '081234567890', dateOfBirth: new Date('1990-01-02') } });
    await db.user.create({ data: { firstName: 'Two', phone: '+6281234567890', dateOfBirth: new Date('1990-01-02') } });
    const otp = await request();
    const proof = await service.verifyMemberOtp(otp.challengeId, otp.code, otp.binding);
    expect(proof).toMatchObject({ kind: 'enroll', stage: 'activate' });
    if (proof.kind !== 'enroll') throw new Error('Expected activation');
    await expect(service.enrollMember(proof.grantToken, otp.binding, { dateOfBirth: '1990-01-02' })).rejects.toMatchObject({ code: 'ENROLLMENT_INVALID' });
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

      const googleMigration = await readFile(resolve('prisma/migrations/20261021000000_add_member_google_accounts/migration.sql'), 'utf8');
      await client.query(googleMigration);
      expect((await client.query('SELECT COUNT(*)::int AS count FROM member_google_accounts')).rows[0].count).toBe(0);
      expect((await client.query("SELECT column_default FROM information_schema.columns WHERE table_name = 'member_login_otps' AND column_name = 'purpose'")).rows[0].column_default).toContain('login');
      expect((await client.query('SELECT id, points FROM users')).rows).toEqual([{ id: 'existing', points: 42 }]);
    } finally { await client.end(); }
  });
});

integrationDescribe('Google member login and profile phone verification', () => {
  it('creates a Google-only member session without a phone and never claims records by email', async () => {
    const patient = await db.user.create({ data: { firstName: 'Patient', email: 'google@example.com', phone: '081234567890', points: 88 } });
    const first = await google.signInGoogleMember(googleIdentity());
    const newMember = await sessions.resolveMemberToken(first.token);
    expect(first.phoneVerified).toBe(false);
    expect(newMember).toMatchObject({ email: 'google@example.com', phone: null, loginPhone: null, hasAccount: true, isAdmin: false, points: 0 });
    expect(newMember?.id).not.toBe(patient.id);
    const again = await google.signInGoogleMember(googleIdentity());
    expect((await sessions.resolveMemberToken(again.token))?.id).toBe(newMember?.id);
    expect(await db.user.count()).toBe(2);
  });

  it('verifies a new number in the same browser, then enables WhatsApp login and full membership', async () => {
    const login = await google.signInGoogleMember(googleIdentity());
    const member = await sessions.resolveMemberToken(login.token);
    const otp = await profileOtp(member!.id);
    await expect(service.verifyMemberOtp(otp.challengeId, otp.code, otp.binding)).rejects.toMatchObject({ code: 'OTP_INVALID' });
    await expect(service.verifyProfilePhoneOtp(member!.id, otp.challengeId, otp.code, browser(), null)).rejects.toMatchObject({ code: 'OTP_INVALID' });
    const verified = await service.verifyProfilePhoneOtp(member!.id, otp.challengeId, otp.code, otp.binding, null);
    expect(verified.kind).toBe('verified');
    if (verified.kind !== 'verified') throw new Error('Expected verified phone');
    expect(await sessions.resolveMemberToken(login.token)).toBeNull();
    expect(await sessions.resolveMemberToken(verified.sessionToken)).toMatchObject({ id: member!.id, loginPhone: otp.phone, phone: otp.phone });
    expect((await db.user.findUniqueOrThrow({ where: { id: member!.id } })).qrToken).toBeTruthy();
    expect((await db.user.findUniqueOrThrow({ where: { id: member!.id } })).affiliateCode).toBeTruthy();
    await expect(service.verifyProfilePhoneOtp(member!.id, otp.challengeId, otp.code, otp.binding, null)).rejects.toMatchObject({ code: 'OTP_INVALID' });
    const wa = await request('6281234567890', browser(), 'other-ip').catch((error) => error);
    expect(wa).toMatchObject({ code: 'OTP_COOLDOWN' });
  });

  it('keeps a Google referral pending until the WhatsApp number is verified', async () => {
    await db.user.create({ data: { firstName: 'Leader', affiliateCode: 'TEAM1', isTeamLeader: true } });
    const login = await google.signInGoogleMember(googleIdentity(), 'TEAM1');
    const stub = await sessions.resolveMemberToken(login.token);
    expect(stub?.affiliateCode).toBeNull();
    expect((await db.memberGoogleAccount.findUniqueOrThrow({ where: { googleSub: 'google-sub' } })).pendingReferralCode).toBe('TEAM1');
    const otp = await profileOtp(stub!.id);
    const verified = await service.verifyProfilePhoneOtp(stub!.id, otp.challengeId, otp.code, otp.binding, null);
    expect(verified.kind).toBe('verified');
    if (verified.kind !== 'verified') throw new Error('Expected verified phone');
    expect(await sessions.resolveMemberToken(verified.sessionToken)).toMatchObject({ affiliateCode: 'TEAM1', isTeamLeader: false });
    expect((await db.memberGoogleAccount.findUniqueOrThrow({ where: { googleSub: 'google-sub' } })).pendingReferralCode).toBeNull();
  });

  it('moves Google login to an existing WhatsApp account after OTP without losing points', async () => {
    const existing = await registered('6281234567890', { points: 45, affiliateCode: 'EXIST1', qrToken: 'existing-qr' });
    const googleSession = await google.signInGoogleMember(googleIdentity());
    const stub = await sessions.resolveMemberToken(googleSession.token);
    const otp = await profileOtp(stub!.id);
    const result = await service.verifyProfilePhoneOtp(stub!.id, otp.challengeId, otp.code, otp.binding, null);
    expect(result.kind).toBe('verified');
    if (result.kind !== 'verified') throw new Error('Expected linked account');
    expect(await sessions.resolveMemberToken(googleSession.token)).toBeNull();
    expect(await sessions.resolveMemberToken(result.sessionToken)).toMatchObject({ id: existing.id, points: 45, qrToken: 'existing-qr' });
    expect((await google.signInGoogleMember(googleIdentity())).phoneVerified).toBe(true);
    expect(await db.user.count()).toBe(1);
    expect(await db.memberGoogleAccount.findUniqueOrThrow({ where: { googleSub: 'google-sub' } })).toMatchObject({ userId: existing.id });
  });

  it('requires matching date of birth for a legacy patient and retains their record', async () => {
    const patient = await db.user.create({ data: { firstName: 'Patient', phone: '081234567890', dateOfBirth: new Date('1990-01-02'), points: 80 } });
    const login = await google.signInGoogleMember(googleIdentity());
    const stub = await sessions.resolveMemberToken(login.token);
    const otp = await profileOtp(stub!.id);
    const result = await service.verifyProfilePhoneOtp(stub!.id, otp.challengeId, otp.code, otp.binding, '1990-01-02');
    expect(result.kind).toBe('verified');
    if (result.kind !== 'verified') throw new Error('Expected legacy activation');
    expect(await sessions.resolveMemberToken(result.sessionToken)).toMatchObject({ id: patient.id, points: 80, loginPhone: otp.phone });
    expect(await db.user.count()).toBe(1);
  });

  it('routes ambiguous legacy records and active temporary accounts to Front Office', async () => {
    await db.user.create({ data: { firstName: 'Patient', phone: '081234567890', dateOfBirth: new Date('1990-01-02') } });
    const login = await google.signInGoogleMember(googleIdentity());
    const stub = await sessions.resolveMemberToken(login.token);
    const otp = await profileOtp(stub!.id);
    expect(await service.verifyProfilePhoneOtp(stub!.id, otp.challengeId, otp.code, otp.binding, '1991-01-02')).toEqual({ kind: 'support' });
    expect(await db.user.count()).toBe(2);
  });

  it('does not discard activity from a Google-only account when linking an existing number', async () => {
    await registered();
    const login = await google.signInGoogleMember(googleIdentity());
    const stub = await sessions.resolveMemberToken(login.token);
    await db.user.update({ where: { id: stub!.id }, data: { points: 5 } });
    const otp = await profileOtp(stub!.id);
    expect(await service.verifyProfilePhoneOtp(stub!.id, otp.challengeId, otp.code, otp.binding, null)).toEqual({ kind: 'support' });
    expect((await db.user.findUniqueOrThrow({ where: { id: stub!.id } })).points).toBe(5);
    expect(await db.user.count()).toBe(2);
  });

  it('keeps login OTP and profile OTP separate and limits wrong profile codes', async () => {
    const login = await google.signInGoogleMember(googleIdentity());
    const stub = await sessions.resolveMemberToken(login.token);
    const loginOtp = await request();
    await expect(service.verifyProfilePhoneOtp(stub!.id, loginOtp.challengeId, loginOtp.code, loginOtp.binding, null)).rejects.toMatchObject({ code: 'OTP_INVALID' });
    await db.memberLoginOtp.update({ where: { id: loginOtp.challengeId }, data: { createdAt: new Date(Date.now() - 61_000) } });
    const otp = await profileOtp(stub!.id);
    const wrong = otp.code === '000000' ? '111111' : '000000';
    await Promise.allSettled(Array.from({ length: 8 }, () => service.verifyProfilePhoneOtp(stub!.id, otp.challengeId, wrong, otp.binding, null)));
    expect((await db.memberLoginOtp.findUniqueOrThrow({ where: { id: otp.challengeId } })).attempts).toBe(5);
    await expect(service.verifyProfilePhoneOtp(stub!.id, otp.challengeId, otp.code, otp.binding, null)).rejects.toMatchObject({ code: 'OTP_INVALID' });
  });

  it('keeps Google and WhatsApp member sessions out of the Clerk admin guard', async () => {
    const { requireAdmin } = await import('@/lib/auth');
    const login = await google.signInGoogleMember(googleIdentity());
    expect(await sessions.resolveMemberToken(login.token)).toBeTruthy();
    await expect(requireAdmin()).rejects.toMatchObject({ status: 401 });
  });
});
