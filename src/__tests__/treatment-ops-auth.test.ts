import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  verify: vi.fn(),
  staffFindFirst: vi.fn(),
  staffFindUnique: vi.fn(),
  staffUpdate: vi.fn(),
  sessionCreate: vi.fn(),
    sessionDeleteMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: mocks.cookies }));
vi.mock('argon2', () => ({ verify: mocks.verify }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    opsStaff: {
      findFirst: mocks.staffFindFirst,
      findUnique: mocks.staffFindUnique,
      update: mocks.staffUpdate,
    },
    opsSession: {
      create: mocks.sessionCreate,
      deleteMany: mocks.sessionDeleteMany,
    },
    $transaction: mocks.transaction,
  },
}));

import { loginOpsStaff } from '@/lib/treatment-operations/auth';

const staff = {
  id: 'staff-1',
  active: true,
  phone: null,
  passwordHash: 'hash',
  failedLoginAttempts: 0,
  lockedUntil: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookies.mockResolvedValue({ set: vi.fn() });
  mocks.verify.mockResolvedValue(true);
  mocks.staffUpdate.mockResolvedValue(staff);
  mocks.sessionCreate.mockResolvedValue({});
  mocks.sessionDeleteMany.mockResolvedValue({ count: 0 });
  mocks.transaction.mockImplementation(async (callback: (transaction: unknown) => unknown) => callback({
    opsSession: { deleteMany: mocks.sessionDeleteMany },
    opsStaff: { findFirst: mocks.staffFindFirst, update: mocks.staffUpdate },
  }));
});

describe('treatment operations login transition', () => {
  it('lets a legacy email-only account sign in during the phone migration', async () => {
    mocks.staffFindFirst
      .mockResolvedValueOnce(staff)
      .mockResolvedValueOnce({ id: staff.id });

    await loginOpsStaff(' Legacy@DRWPrime.com ', 'PrimeAman2026!');

    expect(mocks.staffFindUnique).not.toHaveBeenCalled();
    expect(mocks.staffFindFirst).toHaveBeenNthCalledWith(1, {
      where: { email: 'legacy@drwprime.com', phone: null },
    });
  });

  it('uses the canonical WhatsApp number for migrated accounts', async () => {
    mocks.staffFindUnique.mockResolvedValue({ ...staff, phone: '628123456789' });
    mocks.staffFindFirst.mockResolvedValue({ id: staff.id });

    await loginOpsStaff('0812 3456 789', 'PrimeAman2026!');

    expect(mocks.staffFindUnique).toHaveBeenCalledWith({ where: { phone: '628123456789' } });
    expect(mocks.staffFindFirst).toHaveBeenCalledWith({
      where: { id: staff.id, active: true },
      select: { id: true },
    });
  });

  it('does not use email after a WhatsApp number is registered', async () => {
    mocks.staffFindFirst.mockResolvedValue(null);

    await expect(loginOpsStaff('legacy@drwprime.com', 'PrimeAman2026!')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });

    expect(mocks.staffFindFirst).toHaveBeenCalledWith({
      where: { email: 'legacy@drwprime.com', phone: null },
    });
  });
});
