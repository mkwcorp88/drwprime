import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ create: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { whatsAppOtpDispatch: mocks } }));

import { applyMetaMessageStatus, recordOtpSubmission } from './whatsapp-otp-delivery';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.create.mockResolvedValue({});
  mocks.deleteMany.mockResolvedValue({ count: 0 });
  mocks.updateMany.mockResolvedValue({ count: 1 });
});

describe('WhatsApp OTP delivery tracking', () => {
  it('stores hashes rather than the raw provider message or challenge ID', async () => {
    await recordOtpSubmission('staff', 'private-challenge', {
      messageId: 'wamid.private-message', messageStatus: 'held_for_quality_assessment',
    });
    const data = mocks.create.mock.calls[0][0].data;
    expect(data.flow).toBe('staff');
    expect(data.status).toBe('held');
    expect(data.messageIdHash).toMatch(/^[a-f0-9]{64}$/);
    expect(data.challengeIdHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(data)).not.toContain('private-');
  });

  it('accepts delivery progress and never downgrades a delivered code to sent or failed', async () => {
    await applyMetaMessageStatus({ id: 'wamid.private-message', status: 'delivered' });
    expect(mocks.updateMany.mock.calls[0][0]).toMatchObject({
      where: { status: { in: ['accepted', 'held', 'sent'] } },
      data: { status: 'delivered', errorCode: null },
    });
    await applyMetaMessageStatus({ id: 'wamid.private-message', status: 'failed', errorCode: 131031 });
    expect(mocks.updateMany.mock.calls[1][0]).toMatchObject({
      where: { status: { in: ['accepted', 'held', 'sent'] } },
      data: { status: 'failed', errorCode: 131031 },
    });
  });
});
