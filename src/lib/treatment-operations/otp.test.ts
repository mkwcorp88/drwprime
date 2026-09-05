import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loginOtpDeleteMany: vi.fn(),
  loginOtpFindFirst: vi.fn(),
  loginOtpFindUnique: vi.fn(),
  loginOtpCount: vi.fn(),
  loginOtpCreate: vi.fn(),
  loginOtpUpdateMany: vi.fn(),
  staffFindUnique: vi.fn(),
  sendOtp: vi.fn(),
  completeLogin: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    opsLoginOtp: {
      deleteMany: mocks.loginOtpDeleteMany,
      findFirst: mocks.loginOtpFindFirst,
      findUnique: mocks.loginOtpFindUnique,
      count: mocks.loginOtpCount,
      create: mocks.loginOtpCreate,
      updateMany: mocks.loginOtpUpdateMany,
    },
    opsStaff: { findUnique: mocks.staffFindUnique },
  },
}));

vi.mock('@/lib/whatsapp', () => ({ sendOpsLoginOtpWhatsApp: mocks.sendOtp }));
vi.mock('@/lib/treatment-operations/auth', () => ({ completeOpsLogin: mocks.completeLogin }));

import { isOpsWhatsAppOtpEnabled, requiresOpsPasswordChange } from './auth-mode';
import {
  createOpsOtpCode,
  hashOpsOtpCode,
  requestOpsLoginOtp,
  verifyOpsLoginOtp,
} from './otp';

const originalOtpEnabled = process.env.OPS_WHATSAPP_OTP_ENABLED;
const originalOtpSecret = process.env.OPS_OTP_SECRET;

beforeEach(() => {
  vi.resetAllMocks();
  process.env.OPS_WHATSAPP_OTP_ENABLED = 'true';
  process.env.OPS_OTP_SECRET = 'test-secret-at-least-thirty-two-characters';
  mocks.loginOtpDeleteMany.mockResolvedValue({ count: 0 });
  mocks.loginOtpFindFirst.mockResolvedValue(null);
  mocks.loginOtpFindUnique.mockResolvedValue(null);
  mocks.loginOtpCount.mockResolvedValue(0);
  mocks.loginOtpUpdateMany.mockResolvedValue({ count: 0 });
  mocks.staffFindUnique.mockResolvedValue(null);
  mocks.loginOtpCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    ...data,
    createdAt: new Date(),
  }));
  mocks.sendOtp.mockResolvedValue({ messages: [{ id: 'wamid.test' }] });
});

afterAll(() => {
  if (originalOtpEnabled === undefined) delete process.env.OPS_WHATSAPP_OTP_ENABLED;
  else process.env.OPS_WHATSAPP_OTP_ENABLED = originalOtpEnabled;
  if (originalOtpSecret === undefined) delete process.env.OPS_OTP_SECRET;
  else process.env.OPS_OTP_SECRET = originalOtpSecret;
});

describe('operational WhatsApp OTP', () => {
  it('creates six-digit codes and keyed challenge-specific hashes', () => {
    for (let index = 0; index < 20; index += 1) {
      expect(createOpsOtpCode()).toMatch(/^\d{6}$/);
    }
    expect(hashOpsOtpCode('challenge-one', '123456')).toBe(hashOpsOtpCode('challenge-one', '123456'));
    expect(hashOpsOtpCode('challenge-one', '123456')).not.toBe(hashOpsOtpCode('challenge-two', '123456'));
  });

  it('uses the OTP flag to preserve password rollback behavior', () => {
    expect(isOpsWhatsAppOtpEnabled()).toBe(true);
    expect(requiresOpsPasswordChange({ mustChangePassword: true })).toBe(false);
    process.env.OPS_WHATSAPP_OTP_ENABLED = 'false';
    expect(requiresOpsPasswordChange({ mustChangePassword: true })).toBe(true);
  });

  it('creates a challenge and sends a code only to an active registered staff number', async () => {
    mocks.staffFindUnique.mockResolvedValue({ id: 'staff-1', active: true });

    const result = await requestOpsLoginOtp('0812-3456-7890', '203.0.113.10');

    expect(result.challengeId).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(result.resendAfterSeconds).toBe(60);
    expect(mocks.sendOtp).toHaveBeenCalledOnce();
    expect(mocks.sendOtp.mock.calls[0][0]).toBe('6281234567890');
    expect(mocks.sendOtp.mock.calls[0][1]).toMatch(/^\d{6}$/);
    expect(mocks.loginOtpCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ staffId: 'staff-1' }),
    }));
  });

  it('returns an indistinguishable challenge without sending for an unknown number', async () => {
    mocks.staffFindUnique.mockResolvedValue(null);

    const result = await requestOpsLoginOtp('0812-3456-7890', '203.0.113.10');

    expect(result.challengeId).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(mocks.loginOtpCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ staffId: null }),
    }));
    expect(mocks.sendOtp).not.toHaveBeenCalled();
  });

  it('verifies a valid code once and completes the existing session login', async () => {
    const staff = { id: 'staff-1', active: true, phone: '6281234567890' };
    mocks.staffFindUnique.mockResolvedValue({ id: staff.id, active: true });
    const requested = await requestOpsLoginOtp('0812-3456-7890', '203.0.113.10');
    const createdData = mocks.loginOtpCreate.mock.calls[0][0].data;
    const sentCode = mocks.sendOtp.mock.calls[0][1];
    mocks.loginOtpFindUnique.mockResolvedValue({
      id: requested.challengeId,
      staffId: staff.id,
      phoneHash: createdData.phoneHash,
      codeHash: createdData.codeHash,
      attempts: 0,
      consumedAt: null,
      expiresAt: createdData.expiresAt,
      staff,
    });
    mocks.loginOtpUpdateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    mocks.completeLogin.mockResolvedValue(staff);

    await expect(verifyOpsLoginOtp(requested.challengeId, sentCode)).resolves.toBe(staff);
    expect(mocks.completeLogin).toHaveBeenCalledWith('staff-1');
  });

  it('counts an invalid code without creating a session', async () => {
    const staff = { id: 'staff-1', active: true, phone: '6281234567890' };
    mocks.staffFindUnique.mockResolvedValue({ id: staff.id, active: true });
    const requested = await requestOpsLoginOtp('0812-3456-7890', '203.0.113.10');
    const createdData = mocks.loginOtpCreate.mock.calls[0][0].data;
    const sentCode = mocks.sendOtp.mock.calls[0][1];
    const wrongCode = sentCode === '000000' ? '999999' : '000000';
    mocks.loginOtpFindUnique.mockResolvedValue({
      id: requested.challengeId,
      staffId: 'staff-1',
      phoneHash: createdData.phoneHash,
      codeHash: createdData.codeHash,
      attempts: 0,
      consumedAt: null,
      expiresAt: createdData.expiresAt,
      staff,
    });
    mocks.loginOtpUpdateMany.mockClear();

    await expect(verifyOpsLoginOtp(requested.challengeId, wrongCode)).rejects.toMatchObject({ code: 'OTP_INVALID' });
    expect(mocks.loginOtpUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { attempts: { increment: 1 } },
    }));
    expect(mocks.completeLogin).not.toHaveBeenCalled();
  });
});
